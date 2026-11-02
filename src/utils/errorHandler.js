import axios from 'axios';
import { useToastStore } from '@/store/toastStore';
import { createStructuredLog } from './logger';
import { getHttpAbortSignal } from './httpLifecycle';

// Rate limiting cache for toast notifications
const toastCache = new Map();

/**
 * Registers a global handler for otherwise-unhandled promise rejections so
 * they surface in the structured log (and thus the log download) instead of
 * only appearing in the raw devtools console. The axios interceptor already
 * catches HTTP failures; this is a safety net for everything else (async code
 * that throws without a local try/catch).
 */
export function setupUnhandledRejectionLogging() {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    createStructuredLog('ERROR', 'UNHANDLED_REJECTION', {
      message: reason?.message || String(reason),
      extra: {
        errorName: reason?.name,
        stack: reason?.stack,
      },
    });
  });
}

/**
 * Sets up global axios interceptors for error handling and logging
 */
export function setupErrorHandler() {
  // Request interceptor to track timing
  axios.interceptors.request.use((config) => {
    // Track request start time
    config.metadata = { startTime: performance.now() };
    // Attach the app-wide abort signal (unless the caller brought its own) so
    // stale in-flight requests can be killed on app resume - see httpLifecycle.js.
    if (!config.signal) {
      config.signal = getHttpAbortSignal();
    }
    return config;
  });

  // Response interceptor for error handling
  axios.interceptors.response.use(
    (response) => {
      const url = response.config?.url || 'unknown';
      const method = response.config?.method?.toUpperCase() || 'REQUEST';
      const duration = response.config?.metadata?.startTime
        ? Math.round(performance.now() - response.config.metadata.startTime)
        : null;

      // Check for non-2xx HTTP status codes
      if (response.status < 200 || response.status >= 300) {
        const message = `${method} request failed: ${response.statusText}`;

        createStructuredLog('ERROR', 'HTTP', {
          method,
          url,
          status: response.status,
          message,
          duration,
          extra: { statusText: response.statusText },
        });

        // Show toast for HTTP errors (with rate limiting) but suppress 404s
        if (response.status !== 404) {
          showToast({
            type: 'error',
            title: `HTTP ${response.status}`,
            message,
            cacheKey: `HTTP_${response.status}_${url}`,
            autoClose: true,
          });
        }
      }

      // Check for API-specific error responses (Success: false or StatusCode >= 400)
      const data = response.data;
      if (data && (data.Success === false || (data.StatusCode && data.StatusCode >= 400))) {
        const statusCode = data.StatusCode || response.status;
        // For HTTP 200 with Success: false, show Response text instead of Error text
        const errorMsg =
          response.status === 200
            ? data.Response || data.Error || 'API call completed'
            : data.Error || data.Response || 'API call failed';

        // For HTTP 200 with Success: false, treat as info (API state messages)
        // Only log as ERROR if HTTP status indicates failure
        const isRealError = response.status >= 400;
        const logLevel = isRealError ? 'ERROR' : 'INFO';

        // Skip logging and toasts for known informational endpoints
        const suppressedUrls = [
          '/capture/statistics/full',
          '/image-history',
          // WandererCover-only position endpoints return 501 on other flat devices
          '/equipment/flatdevice/get-currentposition',
          '/equipment/flatdevice/get-openposition',
          '/equipment/flatdevice/set-openposition',
          '/equipment/flatdevice/get-closedposition',
          '/equipment/flatdevice/set-closedposition',
        ];
        const isSuppressedUrl = suppressedUrls.some((u) => url.includes(u));
        if (isSuppressedUrl) return response;

        createStructuredLog(logLevel, 'API', {
          method,
          url,
          status: statusCode,
          message: errorMsg,
          duration,
          extra: {
            httpStatus: response.status,
            apiSuccess: data.Success,
            apiType: data.Type,
          },
        });

        // Show toast for HTTP errors or API StatusCode errors (but not for HTTP 200 + StatusCode 200)
        // Skip toasts for HTTP 200 + StatusCode 200 (successful responses) and all 404s
        // Callers probing a backend in the background (e.g. "is PHD2 running?") opt out
        // of the toast via `suppressErrorToast` in the axios config; the log stays.
        if (
          (response.status >= 400 || statusCode >= 400) &&
          statusCode !== 404 &&
          statusCode !== 409 &&
          statusCode !== 500 &&
          !isSuppressedUrl &&
          !response.config?.suppressErrorToast
        ) {
          showToast({
            type: isRealError ? 'error' : 'info',
            title: isRealError ? `API Error ${statusCode}` : `API Status ${statusCode}`,
            message: errorMsg,
            cacheKey: `API_${statusCode}_${url}_${errorMsg}`,
            autoClose: true,
          });
        }
      } else if (response.status >= 200 && response.status < 300 && duration > 5000) {
        // Check if this is an image request - use higher threshold (10 seconds)
        const isImageRequest = url.includes('/image/');
        const threshold = isImageRequest ? 10000 : 5000;

        if (duration > threshold) {
          // Log slow requests (over threshold)
          createStructuredLog('WARN', 'PERFORMANCE', {
            method,
            url,
            status: response.status,
            message: `Slow request detected`,
            duration,
            extra: { threshold },
          });
        }
      }

      return response;
    },
    (error) => {
      const status = error.response?.status;
      const url = error.config?.url || 'unknown';
      const method = error.config?.method?.toUpperCase() || 'REQUEST';
      const duration = error.config?.metadata?.startTime
        ? Math.round(performance.now() - error.config.metadata.startTime)
        : null;

      // Deliberately canceled (stale requests aborted on app resume): not an
      // error condition, skip the ERROR log/toast machinery entirely.
      if (error.code === 'ERR_CANCELED') {
        return {
          data: {
            Response: '',
            Error: 'Request canceled',
            StatusCode: 499,
            Success: false,
            Type: 'API',
          },
          status: 499,
          config: error.config,
        };
      }

      let message;
      let category = 'NETWORK';

      // A JSON error body carries the server's own reason (Error, ErrorCode); HTML or plain-text
      // bodies from proxies and unknown routes do not. Some plugin controllers answer with
      // lowercase keys ({ "error": "..." }).
      const body = error.response?.data;
      const serverBody = body && typeof body === 'object' && !Array.isArray(body) ? body : null;
      const serverError =
        serverBody?.Error ||
        serverBody?.Message ||
        serverBody?.error ||
        serverBody?.message ||
        null;

      if (status) {
        message = serverError || `${method} request failed`;
        category = 'HTTP';
      } else {
        message = `Connection failed: ${error.message}`;
      }

      createStructuredLog('ERROR', category, {
        method,
        url,
        status: status || 0,
        message,
        duration,
        extra: {
          errorCode: error.code,
          errorMessage: error.message,
          serverErrorCode: serverBody?.ErrorCode,
          timeout: error.config?.timeout,
        },
      });

      // Show toast for network and http errors (with rate limiting)
      /*
      showToast({
        type: 'error',
        title: status ? `HTTP ${status}` : 'Network Error',
        message: status ? `${method} request failed` : `Connection failed: ${error.message}`,
        cacheKey: `NETWORK_${status || 'ERROR'}_${url}`,
      });
      */

      // Return a mock error response instead of rejecting
      // This prevents the calling code from crashing. The server's body is kept so callers
      // can show its reason and branch on its ErrorCode.
      return {
        data: {
          Response: '',
          Type: 'API',
          ...serverBody,
          Error: message,
          StatusCode: serverBody?.StatusCode || status || 500,
          Success: false,
        },
        status: status || 500,
        config: error.config,
      };
    }
  );
}

/**
 * Shows toast notification with rate limiting
 * @param {Object} options - Toast options
 */
function showToast({ type, title, message, cacheKey }) {
  const toastStore = useToastStore();
  const now = Date.now();

  if (!toastCache.has(cacheKey) || now - toastCache.get(cacheKey) > 5000) {
    toastCache.set(cacheKey, now);
    toastStore.showToast({
      type,
      title,
      message,
    });
  }
}
