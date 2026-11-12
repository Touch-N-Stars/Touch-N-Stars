// Toast-style notifications for file downloads (logs, images), shown top right.
// Shared by logDownloader.js and imageDownloader.js; each gets its own container
// and progress id, so a log and an image download do not remove each other's toasts.

const STYLE_ID = 'download-notification-styles';

function addStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    @keyframes checkmark {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);
}

function removeAfter(notification, delayMs) {
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.parentElement.removeChild(notification);
        }
      }, 300);
    }
  }, delayMs);
}

/**
 * @param {object} options
 * @param {string} options.containerId - DOM id of the toast container
 * @param {string} options.progressId - DOM id of the progress toast
 * @param {string} options.progressTitle - default progress title
 * @param {string} options.progressText - default progress subtitle
 * @param {string} options.successTitle
 * @param {string} options.errorTitle
 */
export function createDownloadNotifier({
  containerId,
  progressId,
  progressTitle,
  progressText,
  successTitle,
  errorTitle,
}) {
  addStyles();

  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  function removeProgress() {
    document.getElementById(progressId)?.remove();
  }

  function showProgress(title = progressTitle, text = progressText) {
    removeProgress();

    const notification = document.createElement('div');
    notification.id = progressId;
    notification.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
        border: 1px solid #06b6d4;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 0 20px rgba(6, 182, 212, 0.2);
        backdrop-filter: blur(10px);
        min-width: 280px;
        animation: slideInRight 0.3s ease-out;
        pointer-events: auto;
      ">
        <div style="display: flex; align-items: center; gap: 12px; color: white;">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid #06b6d4;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
          <div>
            <div style="font-weight: 600; font-size: 14px;">${title}</div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${text}</div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(notification);
    return notification;
  }

  function showSuccess(message, details) {
    removeProgress();

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #065f46 0%, #059669 100%);
        border: 1px solid #10b981;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 0 20px rgba(16, 185, 129, 0.3);
        backdrop-filter: blur(10px);
        min-width: 280px;
        animation: slideInRight 0.3s ease-out, pulse 0.5s ease-in-out;
        pointer-events: auto;
        cursor: pointer;
      " onclick="this.parentElement.removeChild(this)">
        <div style="display: flex; align-items: flex-start; gap: 12px; color: white;">
          <div style="
            width: 24px;
            height: 24px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            animation: checkmark 0.5s ease-in-out 0.2s both;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${successTitle}</div>
            <div style="font-size: 12px; color: #d1fae5; line-height: 1.4;">
              ${message}
            </div>
            ${details ? `<div style="font-size: 11px; color: #a7f3d0; margin-top: 4px; opacity: 0.8;">${details}</div>` : ''}
            <div style="font-size: 10px; color: #a7f3d0; margin-top: 6px; opacity: 0.6;">
              Click to dismiss
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(notification);
    removeAfter(notification, 5000);
  }

  function showError(message) {
    removeProgress();

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%);
        border: 1px solid #ef4444;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 0 20px rgba(239, 68, 68, 0.3);
        backdrop-filter: blur(10px);
        min-width: 280px;
        animation: slideInRight 0.3s ease-out, shake 0.5s ease-in-out;
        pointer-events: auto;
        cursor: pointer;
      " onclick="this.parentElement.removeChild(this)">
        <div style="display: flex; align-items: flex-start; gap: 12px; color: white;">
          <div style="
            width: 24px;
            height: 24px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${errorTitle}</div>
            <div style="font-size: 12px; color: #fecaca; line-height: 1.4;">
              ${message}
            </div>
            <div style="font-size: 10px; color: #fecaca; margin-top: 6px; opacity: 0.6;">
              Click to dismiss
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(notification);
    // Errors stay longer
    removeAfter(notification, 7000);
  }

  return { showProgress, showSuccess, showError };
}
