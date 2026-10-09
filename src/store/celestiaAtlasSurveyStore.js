import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import {
  estimateSkySurveyBytes,
  getSkySurveyDefinition,
  normalizeSkySurveyId,
} from '@/integrations/celestiaAtlas/offlineSkySurvey';

// Free-space margin the server applies on top of the estimate (HipsSurveyService.FreeSpaceMargin).
export const SURVEY_FREE_SPACE_MARGIN = 0.1;
// While no job runs the status only changes through user actions, so the 2 s poll
// (criterion: progress survives dialog/app changes) may skip refreshes in between.
const IDLE_REFRESH_MS = 15000;

const storeDefinitions = new Map();

/**
 * Server-side state of one Atlas survey (installed order, running download job), one store
 * per survey id ('dss', 'nsns'). Everything lives on the plugin server; this store is a
 * polled mirror plus the in-flight flags of the four actions. Nothing here is persisted.
 */
export function useCelestiaAtlasSurveyStore(surveyId = 'dss') {
  const id = normalizeSkySurveyId(surveyId);
  if (!storeDefinitions.has(id)) storeDefinitions.set(id, defineSurveyStore(id));
  return storeDefinitions.get(id)();
}

function defineSurveyStore(surveyId) {
  const definition = getSkySurveyDefinition(surveyId);
  // DSS keeps the store id it had before NSNS existed.
  const storeId = surveyId === 'dss' ? 'celestiaAtlasSurvey' : `celestiaAtlasSurvey-${surveyId}`;
  return defineStore(storeId, {
    state: () => ({
      // null = not asked yet, false = plugin without the endpoints, true = available
      supported: null,
      loaded: false,
      status: null,
      error: '',
      busy: false,
      actionError: '',
      lastRefreshAt: 0,
    }),

    getters: {
      installedOrder: (state) => state.status?.installedOrder ?? null,
      /** WebP tiles left by an older plugin; not served any more, replaced by the next download. */
      legacyFormat: (state) => state.status?.legacyFormat === true,
      job: (state) => state.status?.job ?? null,
      isRunning() {
        return this.job?.state === 'running';
      },
      hasAnyData: (state) =>
        state.status?.legacyFormat === true ||
        Boolean(state.status?.orders?.some((order) => Number(order?.tilesPresent) > 0)),
      /** An order that was started but not finished (cancelled/failed/interrupted job). */
      hasPartialOrder: (state) =>
        Boolean(
          state.status?.orders?.some((order) => !order?.complete && Number(order?.tilesPresent) > 0)
        ),
      freeBytes: (state) => {
        const value = state.status?.freeBytes;
        return Number.isFinite(value) ? value : null;
      },
      totalBytes: (state) => Number(state.status?.totalBytes) || 0,
      minOrder: (state) => Number(state.status?.minOrder) || definition.minOrder,
      baseOrder: (state) => Number(state.status?.baseOrder) || definition.baseOrder,
      maxOrder: (state) => Number(state.status?.maxOrder) || definition.maxOrder,
      progressFraction() {
        const job = this.job;
        if (!job || !job.tilesTotal) return 0;
        return Math.min(1, Math.max(0, job.tilesDone / job.tilesTotal));
      },
      /**
       * Selectable download targets with the estimated size of what is still missing for
       * each. Orders at or below the installed one are listed as installed, not selectable.
       */
      orderOptions() {
        const installed = this.installedOrder;
        const options = [];
        for (let order = this.baseOrder; order <= this.maxOrder; order += 1) {
          const installedAlready = installed !== null && order <= installed;
          options.push({
            order,
            installed: installedAlready,
            missingBytes: installedAlready ? 0 : this.estimateMissingBytes(order),
          });
        }
        return options;
      },
    },

    actions: {
      /** Bytes still to download for a target order, accounting for tiles already on disk. */
      estimateMissingBytes(targetOrder) {
        const orders = this.status?.orders;
        let bytes = 0;
        for (let order = this.minOrder; order <= targetOrder; order += 1) {
          const state = orders?.find((entry) => Number(entry?.order) === order);
          const total = estimateSkySurveyBytes(surveyId, order, order);
          if (!state?.tileCount) {
            bytes += total;
            continue;
          }
          const missingFraction =
            Math.max(0, state.tileCount - state.tilesPresent) / state.tileCount;
          bytes += Math.round(total * missingFraction);
        }
        return bytes;
      },

      hasEnoughFreeSpace(targetOrder) {
        const free = this.freeBytes;
        if (free === null) return true;
        const required = this.estimateMissingBytes(targetOrder) * (1 + SURVEY_FREE_SPACE_MARGIN);
        return free >= required;
      },

      async refresh() {
        try {
          const result = await apiService.getAtlasSurveyStatus(surveyId);
          if (result.supported === false) {
            this.supported = false;
            this.status = null;
            this.error = '';
          } else if (result.success) {
            this.supported = true;
            this.status = result;
            this.error = '';
          } else {
            this.error = result.error || 'Survey status unavailable';
          }
        } catch (error) {
          this.error = error?.message || 'Survey status unavailable';
        } finally {
          this.loaded = true;
          this.lastRefreshAt = Date.now();
        }
      },

      /** Poll tick: always refresh while a job runs, otherwise only every IDLE_REFRESH_MS. */
      async tick() {
        if (!this.loaded || this.isRunning || Date.now() - this.lastRefreshAt >= IDLE_REFRESH_MS) {
          await this.refresh();
        }
      },

      async runAction(action) {
        if (this.busy) return false;
        this.busy = true;
        this.actionError = '';
        try {
          const result = await action();
          if (!result.success) {
            this.actionError = result.error || 'Request failed';
            return false;
          }
          await this.refresh();
          return true;
        } catch (error) {
          this.actionError = error?.message || 'Request failed';
          return false;
        } finally {
          this.busy = false;
        }
      },

      startDownload(targetOrder) {
        return this.runAction(() => apiService.startAtlasSurveyDownload(surveyId, targetOrder));
      },

      cancelDownload() {
        return this.runAction(() => apiService.cancelAtlasSurveyDownload(surveyId));
      },

      /** keepOrder: null deletes everything; otherwise only the orders above it. */
      deleteSurvey(keepOrder = null) {
        return this.runAction(() => apiService.deleteAtlasSurvey(surveyId, keepOrder));
      },

      /** Forget everything after an instance switch; the next tick re-polls the new host. */
      reset() {
        this.supported = null;
        this.loaded = false;
        this.status = null;
        this.error = '';
        this.actionError = '';
        this.lastRefreshAt = 0;
      },
    },
  });
}
