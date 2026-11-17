import axios from 'axios';
import { defineStore } from 'pinia';
import i18n from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { createPoller } from '@/utils/poller';

const DEFAULT_BACKEND_PORT = 19091;
const DEFAULT_POLL_INTERVAL_MS = 5000;

export const usePinsAllSkyStore = defineStore('pinsAllSkyStore', {
  state: () => ({
    backendPort: DEFAULT_BACKEND_PORT,
    status: null,
    config: null,
    error: null,
    loading: false,
    saving: false,
    cleanupBusy: false,
    backendUpdateBusy: false,
    actionBusyByKey: {},
    manualLabel: '',
    actionMessage: null,
    sessionDetailsById: {},
    detailsLoadingById: {},
    imageNonce: Date.now(),
    pollTimer: null,
  }),

  getters: {
    settingsStore() {
      return useSettingsStore();
    },

    backendBaseUrl() {
      const protocol = this.settingsStore.backendProtocol || 'http';
      const host = this.settingsStore.connection?.ip || window.location.hostname;
      return `${protocol}://${host}:${this.backendPort}`;
    },

    currentImageUrl() {
      if (!this.status?.currentImageUrl) {
        return null;
      }

      return `${this.backendBaseUrl}${this.status.currentImageUrl}?t=${this.imageNonce}`;
    },
  },

  actions: {
    async fetchStatus() {
      const { data } = await axios.get(`${this.backendBaseUrl}/api/status`);
      this.status = data.data;
      this.error = data.success
        ? null
        : data.error || i18n.global.t('plugins.pinsAllSky.errors.loadStatus');
      this.imageNonce = Date.now();
      return this.status;
    },

    async fetchConfig() {
      const { data } = await axios.get(`${this.backendBaseUrl}/api/config`);
      this.config = data.data;
      this.error = data.success
        ? null
        : data.error || i18n.global.t('plugins.pinsAllSky.errors.loadConfig');
      return this.config;
    },

    async refreshAll() {
      return this.withAction('status:refresh', async () => {
        this.loading = true;
        try {
          await Promise.all([this.fetchStatus(), this.fetchConfig()]);
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.connectBackend');
        } finally {
          this.loading = false;
        }
      });
    },

    async saveConfig() {
      this.saving = true;
      try {
        const { data } = await axios.put(`${this.backendBaseUrl}/api/config`, this.config);
        if (!data.success) {
          throw new Error(data.error || i18n.global.t('plugins.pinsAllSky.errors.saveConfig'));
        }

        this.config = data.data;
        await this.fetchStatus();
        this.error = null;
      } catch (error) {
        this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.saveConfig');
      } finally {
        this.saving = false;
      }
    },

    async startSession() {
      return this.withAction('session:start', async () => {
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/start`, {
            label: this.manualLabel || null,
          });

          if (!data.success) {
            throw new Error(data.error || i18n.global.t('plugins.pinsAllSky.errors.startSession'));
          }

          this.manualLabel = '';
          await this.fetchStatus();
          this.error = null;
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.startSession');
        }
      });
    },

    async stopSession(generateArtifacts = true) {
      return this.withAction('session:stop', async () => {
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/stop`, {
            generateArtifacts,
          });

          if (!data.success) {
            throw new Error(data.error || i18n.global.t('plugins.pinsAllSky.errors.stopSession'));
          }

          await this.fetchStatus();
          this.error = null;
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.stopSession');
        }
      });
    },

    async generateArtifacts(sessionId = null) {
      const actionKey = `session:generate:${sessionId || this.status?.currentSession?.id || 'latest'}`;

      return this.withAction(actionKey, async () => {
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/generate`, {
            sessionId,
          });

          if (!data.success) {
            throw new Error(
              data.error || i18n.global.t('plugins.pinsAllSky.errors.generateArtifacts')
            );
          }

          await this.fetchStatus();
          this.error = null;
        } catch (error) {
          this.error =
            error?.message || i18n.global.t('plugins.pinsAllSky.errors.generateArtifacts');
        }
      });
    },

    async deleteSession(sessionId) {
      return this.withAction(`session:delete:${sessionId}`, async () => {
        this.cleanupBusy = true;
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/delete`, {
            sessionId,
          });

          if (!data.success) {
            throw new Error(data.error || i18n.global.t('plugins.pinsAllSky.errors.deleteSession'));
          }

          const deletedSessionCount = data.data?.deletedSessionCount || 0;
          const freedBytes = data.data?.freedBytes || 0;
          const remainingUsed = data.data?.storage?.pluginUsedBytes ?? 0;
          this.actionMessage =
            deletedSessionCount === 0
              ? i18n.global.t('plugins.pinsAllSky.messages.noSessionsDeleted')
              : i18n.global.t('plugins.pinsAllSky.messages.deletedSessions', {
                  count: deletedSessionCount,
                  freed: this.formatSize(freedBytes),
                  remaining: this.formatSize(remainingUsed),
                });
          delete this.sessionDetailsById[sessionId];
          delete this.detailsLoadingById[sessionId];
          await this.fetchStatus();
          this.error = null;
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.deleteSession');
        } finally {
          this.cleanupBusy = false;
        }
      });
    },

    async deleteAllSessions() {
      return this.withAction('sessions:delete-all', async () => {
        this.cleanupBusy = true;
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/sessions/delete-all`, {});

          if (!data.success) {
            throw new Error(
              data.error || i18n.global.t('plugins.pinsAllSky.errors.deleteAllSessions')
            );
          }

          const deletedSessionCount = data.data?.deletedSessionCount || 0;
          const freedBytes = data.data?.freedBytes || 0;
          const remainingUsed = data.data?.storage?.pluginUsedBytes ?? 0;
          this.actionMessage =
            deletedSessionCount === 0
              ? i18n.global.t('plugins.pinsAllSky.messages.noSessionsDeleted')
              : i18n.global.t('plugins.pinsAllSky.messages.deletedSessions', {
                  count: deletedSessionCount,
                  freed: this.formatSize(freedBytes),
                  remaining: this.formatSize(remainingUsed),
                });
          this.sessionDetailsById = {};
          this.detailsLoadingById = {};
          await this.fetchStatus();
          this.error = null;
        } catch (error) {
          this.error =
            error?.message || i18n.global.t('plugins.pinsAllSky.errors.deleteAllSessions');
        } finally {
          this.cleanupBusy = false;
        }
      });
    },

    async fetchSessionDetails(sessionId) {
      if (!sessionId) {
        return null;
      }

      return this.withAction(`session:details:${sessionId}`, async () => {
        this.detailsLoadingById = {
          ...this.detailsLoadingById,
          [sessionId]: true,
        };

        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/details`, {
            sessionId,
          });

          if (!data.success) {
            throw new Error(
              data.error || i18n.global.t('plugins.pinsAllSky.errors.loadSessionDetails')
            );
          }

          this.sessionDetailsById = {
            ...this.sessionDetailsById,
            [sessionId]: data.data,
          };
          this.error = null;
          return data.data;
        } catch (error) {
          this.error =
            error?.message || i18n.global.t('plugins.pinsAllSky.errors.loadSessionDetails');
          return null;
        } finally {
          this.detailsLoadingById = {
            ...this.detailsLoadingById,
            [sessionId]: false,
          };
        }
      });
    },

    async deleteArtifact(sessionId, relativePath) {
      const actionKey = `artifact:delete:${sessionId}:${relativePath}`;

      return this.withAction(actionKey, async () => {
        this.cleanupBusy = true;
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/artifact/delete`, {
            sessionId,
            relativePath,
          });

          if (!data.success) {
            throw new Error(
              data.error || i18n.global.t('plugins.pinsAllSky.errors.deleteArtifact')
            );
          }

          this.actionMessage = i18n.global.t('plugins.pinsAllSky.messages.deletedArtifact', {
            freed: this.formatSize(data.data?.freedBytes || 0),
          });
          await Promise.all([this.fetchStatus(), this.fetchSessionDetails(sessionId)]);
          this.error = null;
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.deleteArtifact');
        } finally {
          this.cleanupBusy = false;
        }
      });
    },

    async deleteFrame(sessionId, relativePath) {
      const actionKey = `frame:delete:${sessionId}:${relativePath}`;

      return this.withAction(actionKey, async () => {
        this.cleanupBusy = true;
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/session/frame/delete`, {
            sessionId,
            relativePath,
          });

          if (!data.success) {
            throw new Error(data.error || i18n.global.t('plugins.pinsAllSky.errors.deleteFrame'));
          }

          this.actionMessage = i18n.global.t('plugins.pinsAllSky.messages.deletedFrame', {
            freed: this.formatSize(data.data?.freedBytes || 0),
          });
          await Promise.all([this.fetchStatus(), this.fetchSessionDetails(sessionId)]);
          this.error = null;
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.deleteFrame');
        } finally {
          this.cleanupBusy = false;
        }
      });
    },

    async updateBackend() {
      return this.withAction('backend:update', async () => {
        this.backendUpdateBusy = true;
        try {
          const { data } = await axios.post(`${this.backendBaseUrl}/api/backend/update`, {});

          if (!data.success) {
            throw new Error(
              data.error || i18n.global.t('plugins.pinsAllSky.errors.startBackendUpdate')
            );
          }

          this.actionMessage =
            data.data?.message || i18n.global.t('plugins.pinsAllSky.messages.backendUpdateStarted');
          this.error = null;
          return data.data;
        } catch (error) {
          this.error =
            error?.message || i18n.global.t('plugins.pinsAllSky.errors.startBackendUpdate');
          return null;
        } finally {
          this.backendUpdateBusy = false;
        }
      });
    },

    clearActionMessage() {
      this.actionMessage = null;
    },

    setActionBusy(key, busy) {
      if (!key) {
        return;
      }

      const nextState = { ...this.actionBusyByKey };
      if (busy) {
        nextState[key] = true;
      } else {
        delete nextState[key];
      }

      this.actionBusyByKey = nextState;
    },

    isActionBusy(key) {
      return Boolean(key && this.actionBusyByKey[key]);
    },

    async withAction(key, callback) {
      if (!key) {
        return callback();
      }

      if (this.isActionBusy(key)) {
        return null;
      }

      this.setActionBusy(key, true);
      try {
        return await callback();
      } finally {
        this.setActionBusy(key, false);
      }
    },

    artifactUrl(relativePath) {
      if (!relativePath) {
        return null;
      }

      return `${this.backendBaseUrl}/media/${relativePath}`;
    },

    downloadUrl(relativePath, suggestedName = null) {
      if (!relativePath) {
        return null;
      }

      const params = new URLSearchParams({ path: relativePath });
      if (suggestedName) {
        params.set('name', suggestedName);
      }

      return `${this.backendBaseUrl}/api/download?${params.toString()}`;
    },

    isNativeDownloadEnvironment() {
      const userAgent = navigator?.userAgent || '';
      return Boolean(window?.Capacitor?.isNativePlatform?.()) || /; wv\)|\bwv\b/i.test(userAgent);
    },

    async downloadFile(
      relativePath,
      fallbackName = i18n.global.t('plugins.pinsAllSky.common.download')
    ) {
      const actionKey = `download:${relativePath}:${fallbackName || ''}`;

      return this.withAction(actionKey, async () => {
        const url = this.downloadUrl(relativePath, fallbackName);
        if (!url) {
          return;
        }

        try {
          if (this.isNativeDownloadEnvironment()) {
            const openedWindow = window.open(url, '_blank', 'noopener');
            if (!openedWindow) {
              window.location.href = url;
            }

            this.error = null;
            return;
          }

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              i18n.global.t('plugins.pinsAllSky.errors.downloadFailed', {
                status: response.status,
              })
            );
          }

          const blob = await response.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = fallbackName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => {
            window.URL.revokeObjectURL(objectUrl);
          }, 1000);
          this.error = null;
        } catch (error) {
          this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.downloadFile');
        }
      });
    },

    formatSize(bytes) {
      if (!bytes && bytes !== 0) {
        return '—';
      }

      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let value = bytes;
      let unitIndex = 0;

      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
      }

      const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
      return `${value.toFixed(precision)} ${units[unitIndex]}`;
    },

    startPolling() {
      this.stopPolling();
      this.pollTimer = createPoller(
        () =>
          this.fetchStatus().catch((error) => {
            this.error = error?.message || i18n.global.t('plugins.pinsAllSky.errors.refreshStatus');
          }),
        DEFAULT_POLL_INTERVAL_MS
      );
      this.pollTimer.start();
    },

    stopPolling() {
      this.pollTimer?.stop();
      this.pollTimer = null;
    },

    isPolling() {
      return this.pollTimer?.isRunning() === true;
    },
  },
});
