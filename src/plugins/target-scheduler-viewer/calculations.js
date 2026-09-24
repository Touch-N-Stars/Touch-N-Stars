// Pure calculation/formatting helpers extracted from the plugin's components
// so they can be unit tested directly (component .vue files are not
// unit-testable in this repo's node:test setup — see test-loader.mjs, which
// stubs .vue imports to an empty module).

export function formatRa(hours) {
  const h = Math.floor(hours);
  const mFloat = (hours - h) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${h}h ${m}m ${s}s`;
}

export function formatDec(deg) {
  const sign = deg < 0 ? '-' : '+';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${sign}${d}° ${m}' ${s}"`;
}

// -1 = no auto-accept threshold configured for this filter; 0/1 = below-
// threshold boolean (nullable-bool-as-int, the common .NET serialization
// pattern — the API does not document this field, so treat as best-effort).
export function autoAcceptStatus(value) {
  if (value == null || value < 0) return null;
  return value === 1;
}

export function exposureDurationsByFilter(exposurePlan) {
  const map = new Map();
  for (const plan of exposurePlan || []) {
    map.set(plan.FilterName, plan.Exposure);
  }
  return map;
}

// Accepted/pending fill widths (%) for the exposure meter. Pending is
// Acquired-but-not-yet-Accepted (awaiting grading); both are clamped so a
// target that went over its Desired count after reshoots/edits never
// renders a bar wider than 100%.
export function computeExposureBarFill(plan) {
  if (!plan.Desired) return { acceptedPct: 0, pendingPct: 0 };
  const acceptedPct = Math.min(100, (plan.Accepted / plan.Desired) * 100);
  const pending = Math.max(0, plan.Acquired - plan.Accepted);
  const pendingPct = Math.min(100 - acceptedPct, (pending / plan.Desired) * 100);
  return { acceptedPct, pendingPct };
}

export function formatIntegrationTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Accepted integration time for a single exposure plan row (one filter).
export function planIntegrationSeconds(plan) {
  return (plan?.Accepted || 0) * (plan?.Exposure || 0);
}

// Expected integration time for a single exposure plan row if it runs to
// completion (Desired × Exposure) — the full plan, not just what's secured.
export function planExpectedIntegrationSeconds(plan) {
  return (plan?.Desired || 0) * (plan?.Exposure || 0);
}

// Aggregate Desired/Accepted/integration time across every filter of every
// target in a project (or any target list) into a single rollup, clamped to
// 100% for the same over-completion reason as computeExposureBarFill.
// Reports both the accepted (secured so far) and expected (full plan, if
// every Desired frame were accepted) integration time.
export function computeRollup(targets) {
  let desired = 0;
  let accepted = 0;
  let integrationSeconds = 0;
  let expectedIntegrationSeconds = 0;
  for (const target of targets || []) {
    for (const plan of target.ExposurePlan || []) {
      desired += plan.Desired;
      accepted += plan.Accepted;
      integrationSeconds += planIntegrationSeconds(plan);
      expectedIntegrationSeconds += planExpectedIntegrationSeconds(plan);
    }
  }
  const remainingIntegrationSeconds = Math.max(0, expectedIntegrationSeconds - integrationSeconds);

  return {
    desired,
    accepted,
    pct: desired > 0 ? Math.min(100, Math.round((accepted / desired) * 100)) : 0,
    integrationSeconds,
    integrationTime: formatIntegrationTime(integrationSeconds),
    expectedIntegrationSeconds,
    expectedIntegrationTime: formatIntegrationTime(expectedIntegrationSeconds),
    remainingIntegrationSeconds,
    remainingIntegrationTime: formatIntegrationTime(remainingIntegrationSeconds),
  };
}

// Accepted/expected integration time for a single target, summed across its
// filters.
export function computeTargetIntegration(target) {
  return computeRollup([target]);
}

// 'not-started' (nothing accepted yet), 'done' (every desired frame
// accepted, or over-completed after reshoots/edits), 'in-progress'
// (somewhere in between). A target with no exposure plan at all counts as
// not-started rather than done.
export function classifyTargetCompletion(target) {
  const { desired, accepted } = computeRollup([target]);
  if (desired === 0 || accepted <= 0) return 'not-started';
  if (accepted >= desired) return 'done';
  return 'in-progress';
}

// Profile-wide summary: active project count, total target count, overall
// completion %, and accepted/expected integration time, summed across every
// project's targets.
export function computeSummary(projects, targetsByProject) {
  if (!projects) return null;
  const activeProjects = projects.filter((p) => p.State === 'Active').length;

  const allTargets = Object.values(targetsByProject || {}).flatMap((p) => p.targets);
  const rollup = computeRollup(allTargets);

  return {
    activeProjects,
    targetCount: allTargets.length,
    completionPct: rollup.pct,
    integrationTime: rollup.integrationTime,
    expectedIntegrationTime: rollup.expectedIntegrationTime,
    remainingIntegrationTime: rollup.remainingIntegrationTime,
  };
}

// Returns structured row descriptors rather than formatted display strings —
// this module has no access to vue-i18n (it's plain logic, unit-testable
// without mounting a component), so all label/unit/enum text is produced by
// the caller (ProjectCard.vue) via t().
export function buildProjectSettingsRows(project) {
  return [
    { key: 'description', text: project.Description || null },
    { key: 'minimumTime', minutes: project.MinimumTime },
    { key: 'filterSwitchFrequency', text: project.FilterSwitchFrequency },
    { key: 'ditherEvery', count: project.DitherEvery },
    { key: 'meridianWindow', minutes: project.MeridianWindow },
    { key: 'horizon', custom: project.UseCustomHorizon, offset: project.HorizonOffset },
    { key: 'altitudeLimits', min: project.MinimumAltitude, max: project.MaximumAltitude },
    { key: 'grading', enabled: project.EnableGrader },
    { key: 'smartExposureOrder', enabled: project.SmartExposureOrder },
    { key: 'mosaic', enabled: project.Mosaic },
  ];
}

export function formatSegmentDuration(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function summarizeExposurePlan(exposurePlan) {
  const byFilter = new Map();
  for (const p of exposurePlan || []) {
    byFilter.set(p.FilterName, (byFilter.get(p.FilterName) || 0) + p.Count);
  }
  return [...byFilter.entries()].map(([filter, count]) => `${count}× ${filter}`).join(', ');
}

// A segment is "now" when the current time falls in [StartTime, EndTime) —
// purely a clock-position marker on the *predicted* timeline, never a claim
// about what NINA is actually imaging (the API has no such signal).
export function isSegmentNow(segment, nowMs = Date.now()) {
  return (
    nowMs >= new Date(segment.StartTime).getTime() && nowMs < new Date(segment.EndTime).getTime()
  );
}

// Every distinct filter name in use across a set of targets, sorted.
export function collectFilterNames(targets) {
  const names = new Set();
  for (const target of targets || []) {
    for (const plan of target.ExposurePlan || []) {
      names.add(plan.FilterName);
    }
  }
  return [...names].sort();
}

const SORT_COMPARATORS = {
  name: (a, b) => a.project.Name.localeCompare(b.project.Name),
  priority: (a, b) => a.project.Priority - b.project.Priority,
  completion: (a, b) => a.rollup.pct - b.rollup.pct,
  remaining: (a, b) => a.rollup.remainingIntegrationSeconds - b.rollup.remainingIntegrationSeconds,
};

// Sorts projects by name/priority/completion/remaining time. `rollupsById`
// maps project.Id -> computeRollup(...) result for that project's targets
// (the caller computes these once and reuses them, since sorting needs the
// same rollups the UI already displays). Unknown sortKey falls back to name.
export function sortProjects(projects, rollupsById, sortKey, direction = 'asc') {
  const comparator = SORT_COMPARATORS[sortKey] || SORT_COMPARATORS.name;
  const sign = direction === 'desc' ? -1 : 1;
  const decorated = projects.map((project) => ({
    project,
    rollup: rollupsById[project.Id] || computeRollup([]),
  }));
  decorated.sort((a, b) => sign * comparator(a, b));
  return decorated.map((d) => d.project);
}

// Renders the visible projects/targets as a Markdown document, suitable for
// pasting into a forum post or chat — one section per project, one bullet
// per target with its per-filter progress.
export function projectsToMarkdown(projects, targetsByProject, { profileName, generatedAt } = {}) {
  const lines = ['# Target Scheduler Progress', ''];
  if (profileName) lines.push(`Profile: ${profileName}`);
  lines.push(`Generated: ${(generatedAt || new Date()).toLocaleString()}`, '');

  for (const project of projects) {
    const targets = targetsByProject[project.Id]?.targets || [];
    const rollup = computeRollup(targets);
    lines.push(`## ${project.Name} — ${project.State} (${rollup.pct}%)`, '');

    if (!targets.length) {
      lines.push('_No targets._', '');
      continue;
    }

    for (const target of targets) {
      const targetRollup = computeRollup([target]);
      lines.push(
        `- **${target.Name}** (RA ${formatRa(target.RA)}, Dec ${formatDec(target.Dec)}) — ${targetRollup.pct}%`
      );
      for (const plan of target.ExposurePlan || []) {
        lines.push(`  - ${plan.FilterName}: ${plan.Accepted}/${plan.Desired}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
