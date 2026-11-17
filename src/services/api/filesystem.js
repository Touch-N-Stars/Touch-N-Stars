import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls, getPinsDaemonAuthHeaders } from './core';
import { getHttpAbortSignal } from '@/utils/httpLifecycle';

// File transfers are not covered by DEFAULT_TIMEOUT (10 s): a 50 MB FITS over Wi-Fi
// needs far longer than a status request.
const FILE_TRANSFER_TIMEOUT = 120000;

// The global axios interceptors (errorHandler.js) turn every failed request - HTTP
// errors and cancellations alike - into a *resolved* mock response, so callers never
// see a rejection. That suits status polling, but the filesystem controller needs the
// real error: a cancelled blob transfer must not hand file-saver a mock object, and a
// 409 on rename has to reach the dialog with the backend's reason instead of closing
// it silently. This instance carries no interceptors; the app-wide resume abort signal
// is attached by hand so stale transfers still die on resume (see httpLifecycle.js).
const filesystemHttp = axios.create();
filesystemHttp.interceptors.request.use((config) => {
  if (!config.signal) {
    config.signal = getHttpAbortSignal();
  }
  return config;
});

// The filesystem controller answers errors as { success: false, error } with a real
// status code. Without this the raw axios message ("Request failed with status code
// 404") ends up in the UI instead of the backend's reason.
function mapFilesystemError(error, fallbackMessage) {
  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
    return error;
  }

  const status = error?.response?.status;
  const data = error?.response?.data;
  // A blob/arraybuffer response body cannot be inspected for an error message.
  const detail =
    (typeof data === 'object' &&
    data !== null &&
    !(data instanceof Blob) &&
    !(data instanceof ArrayBuffer)
      ? data.error || data.message
      : null) ||
    (status ? `${fallbackMessage} (HTTP ${status})` : error?.message) ||
    fallbackMessage;

  const mappedError = new Error(detail);
  if (status) mappedError.status = status;
  return mappedError;
}

export default {
  // Directory listing via HocusFocus plugin API (more reliable than PINS daemon for local paths)
  async listDirectories(path, timeout = DEFAULT_TIMEOUT) {
    if (!path || typeof path !== 'string') {
      return [];
    }
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}hocusfocus/browse-directories`, {
        params: { path },
        timeout,
      });
      if (response.data?.Success) {
        return response.data.directories || [];
      }
      const errMsg = response.data?.Error || 'Failed to load directory';
      const err = new Error(errMsg);
      throw err;
    } catch (error) {
      const status = error?.response?.status;
      const detail =
        error?.response?.data?.Error ||
        error?.response?.data?.message ||
        error?.message ||
        'Unknown error';
      const mappedError = new Error(detail);
      if (status) mappedError.status = status;
      throw mappedError;
    }
  },

  // api to get filesystem paths for image save path selection in settings
  async getFileDevices(timeout = DEFAULT_TIMEOUT) {
    try {
      const { PINSDAEMON_URL } = getUrls();
      const response = await axios.get(`${PINSDAEMON_URL}/files/devices`, {
        timeout,
        headers: getPinsDaemonAuthHeaders(),
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (error?.response?.status === 401) {
        const unauthorizedError = new Error('Unauthorized: missing or invalid API token');
        unauthorizedError.status = 401;
        throw unauthorizedError;
      }
      console.error('getFileDevices error:', error);
      return [];
    }
  },

  async listFileDirectories(path, timeout = DEFAULT_TIMEOUT) {
    if (!path || typeof path !== 'string') {
      return [];
    }

    try {
      const { PINSDAEMON_URL } = getUrls();
      const response = await axios.get(`${PINSDAEMON_URL}/files/list`, {
        params: { path },
        timeout,
        headers: getPinsDaemonAuthHeaders(),
      });
      // Backend contract: this endpoint returns an array and uses [] as a valid empty result.
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (error?.response?.status === 401) {
        const unauthorizedError = new Error('Unauthorized: missing or invalid API token');
        unauthorizedError.status = 401;
        throw unauthorizedError;
      }
      // Backend may return [] on failures; frontend treats empty list as the safe fallback.
      console.warn('listFileDirectories fallback to []:', error?.message || error);
      return [];
    }
  },

  async createFileDirectory(path, name, timeout = DEFAULT_TIMEOUT) {
    try {
      const { PINSDAEMON_URL } = getUrls();
      const response = await axios.post(
        `${PINSDAEMON_URL}/files/create-dir`,
        { path, name },
        {
          timeout,
          headers: getPinsDaemonAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 401) {
        const mappedError = new Error(detail || 'Unauthorized: missing or invalid API token');
        mappedError.status = status;
        throw mappedError;
      }

      if ((status === 400 || status === 403) && detail) {
        const mappedError = new Error(detail);
        mappedError.status = status;
        throw mappedError;
      }

      console.error('createFileDirectory error:', error);
      throw error;
    }
  },

  // New filesystem endpoints
  async browseFilesystem(path = '') {
    const { API_URL } = getUrls();
    const params = path ? { path } : {};
    try {
      const response = await filesystemHttp.get(`${API_URL}filesystem/browse`, {
        params,
        timeout: DEFAULT_TIMEOUT,
      });
      return response.data; // { success, currentPath, parentPath, directories[], files[] }
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to load directory contents');
    }
  },

  async createFilesystemDirectory(path) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.post(
        `${API_URL}filesystem/directory`,
        { path },
        { timeout: DEFAULT_TIMEOUT }
      );
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to create directory');
    }
  },

  async deleteFilesystemDirectory(path) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.delete(`${API_URL}filesystem/directory`, {
        params: { path },
        timeout: DEFAULT_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to delete directory');
    }
  },

  async deleteFilesystemFile(path) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.delete(`${API_URL}filesystem/file`, {
        params: { path },
        timeout: DEFAULT_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to delete file');
    }
  },

  async renameFilesystemEntry(sourcePath, targetPath) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.put(
        `${API_URL}filesystem/rename`,
        { sourcePath, targetPath },
        { timeout: DEFAULT_TIMEOUT }
      );
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to rename entry');
    }
  },

  getFilesystemFileStreamUrl(path, { download = false } = {}) {
    const { API_URL } = getUrls();
    const url = `${API_URL}filesystem/file?path=${encodeURIComponent(path || '')}`;
    return download ? `${url}&download=1` : url;
  },

  // Server-rendered preview (Phase 2): a pure URL builder, not a fetch — bind it directly
  // to <img src>, the same way getFilesystemFileStreamUrl() is used for plain images.
  getFilesystemPreviewUrl(
    path,
    { maxWidth, quality, stretch, blackClipping, unlinked, debayer } = {}
  ) {
    const { API_URL } = getUrls();
    const params = new URLSearchParams({ path: path || '' });
    if (maxWidth != null) params.set('maxWidth', maxWidth);
    if (quality != null) params.set('quality', quality);
    if (stretch != null) params.set('stretch', stretch);
    if (blackClipping != null) params.set('blackClipping', blackClipping);
    if (unlinked != null) params.set('unlinked', unlinked ? '1' : '0');
    if (debayer != null) params.set('debayer', debayer ? '1' : '0');
    return `${API_URL}filesystem/preview?${params.toString()}`;
  },

  async fetchFilesystemImageInfo(path, { signal } = {}) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.get(`${API_URL}filesystem/imageinfo`, {
        params: { path },
        timeout: DEFAULT_TIMEOUT,
        signal,
      });
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to read image info');
    }
  },

  async fetchFilesystemFileBuffer(path) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.get(`${API_URL}filesystem/file`, {
        params: { path },
        responseType: 'arraybuffer',
        timeout: FILE_TRANSFER_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to read file');
    }
  },

  // Used for "save to device": the download flag makes the backend answer with
  // Content-Disposition: attachment.
  async fetchFilesystemFileBlob(path, { onDownloadProgress, signal } = {}) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.get(`${API_URL}filesystem/file`, {
        params: { path, download: 1 },
        responseType: 'blob',
        timeout: FILE_TRANSFER_TIMEOUT,
        onDownloadProgress,
        signal,
      });
      return {
        blob: response.data,
        contentType: response.headers?.['content-type'] || 'application/octet-stream',
      };
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to download file');
    }
  },

  async fetchFilesystemFileText(path) {
    const { API_URL } = getUrls();
    try {
      const response = await filesystemHttp.get(`${API_URL}filesystem/file`, {
        params: { path },
        responseType: 'text',
        timeout: FILE_TRANSFER_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      throw mapFilesystemError(error, 'Failed to read file');
    }
  },

  // Available Serial Ports
  async availableSerialPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}indi/serialports`);
      const data = response.data.Response;
      if (data && Array.isArray(data.Ports)) {
        const toPorts = (links) =>
          (links || []).map((link) => ({
            Port: link.Path,
            Description: link.Description || '',
          }));
        const groups = [
          { label: '─── by-id ───', ports: toPorts(data.ByIdLinks) },
          { label: '─── by-path ───', ports: toPorts(data.ByPathLinks) },
        ];

        const result = [...data.Ports];
        for (const group of groups) {
          if (group.ports.length > 0) {
            result.push(
              { Port: '', Description: '', separator: true, label: group.label },
              ...group.ports
            );
          }
        }
        return result;
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching available serial ports:', error);
      return [];
    }
  },
};
