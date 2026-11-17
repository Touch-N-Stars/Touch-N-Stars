// Helpers for flat assistant runs that execute inside the Touch'N'Stars plugin
// (/api/flats/*, FlatWizardService). The plugin owns the whole run - flats for
// every filter, then dark flats - so it keeps going while the app is closed.
// These functions only translate its status payload into the store's shapes.

export const SERVER_WORKFLOW_VERSION = 2;

const FILTER_RESULT_STATES = ['success', 'failed', 'dim', 'bright', 'stopped'];
const FAILURE_STATES = ['failed', 'dim', 'bright'];

/** True when a /api/flats/status payload comes from the plugin-side run. */
export function isServerWorkflowStatus(status) {
  return Number(status?.Workflow) >= SERVER_WORKFLOW_VERSION;
}

/**
 * Per-filter result map in the shape MultiMode.vue renders:
 * { [filterId]: null | 'success' | 'failed' | 'dim' | 'bright' | 'stopped' }.
 * Filters still pending or running map to null.
 */
export function mapFilterResults(filters) {
  const results = {};
  for (const filter of filters ?? []) {
    if (filter?.FilterId === null || filter?.FilterId === undefined) continue;
    results[filter.FilterId] = FILTER_RESULT_STATES.includes(filter.State) ? filter.State : null;
  }
  return results;
}

/**
 * Summary of a finished plugin-side run in the store's `lastRun` shape, plus a
 * `darks` block when dark flats were requested.
 */
export function buildServerRunSummary(status, { dimLabel, brightLabel } = {}) {
  const filters = status?.Filters ?? [];
  const total = filters.reduce((sum, f) => sum + (Number(f.Count) || 0), 0);
  const completed = filters.reduce((sum, f) => sum + Math.max(0, Number(f.Completed) || 0), 0);
  const success = filters.length > 0 && filters.every((f) => f.State === 'success');

  const failedFilterNames = filters
    .filter((f) => FAILURE_STATES.includes(f.State))
    .map((f) => {
      const name = f.FilterName || (f.FilterId ?? '').toString();
      if (f.State === 'dim' && dimLabel) return `${name} (${dimLabel})`;
      if (f.State === 'bright' && brightLabel) return `${name} (${brightLabel})`;
      return name;
    })
    .filter(Boolean);

  let darks = null;
  if (Number(status?.DarkCount) > 0) {
    // Dark flats are only taken for filters whose flats succeeded.
    const planned = filters.filter(
      (f) => f.State === 'success' && f.DarkState && f.DarkState !== 'none'
    );
    darks = {
      completed: planned.reduce((sum, f) => sum + (Number(f.DarkCompleted) || 0), 0),
      total: planned.reduce((sum, f) => sum + (Number(f.DarkCount) || 0), 0),
      // Skipped although the flats succeeded: the user declined to cover the telescope.
      skipped: planned.some((f) => f.DarkState === 'skipped'),
    };
  }

  const lastFilterWithADU = [...filters]
    .reverse()
    .find((f) => f.LastADU !== null && f.LastADU !== undefined);

  // The plugin's reason for ending a run on its own, e.g. "Stopped because a sequence started"
  const stopReason =
    typeof status?.Error === 'string' && status.Error.trim() ? status.Error.trim() : null;

  return {
    type: filters.length > 1 ? 'flats-multi' : 'flats',
    stopReason,
    completed,
    total,
    success,
    lastADU:
      status?.CurrentADU !== null && status?.CurrentADU !== undefined
        ? Math.round(status.CurrentADU)
        : lastFilterWithADU
          ? Math.round(lastFilterWithADU.LastADU)
          : null,
    failedFilterNames,
    darks,
  };
}
