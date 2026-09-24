<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@/store/toastStore';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import ProjectCard from '../components/ProjectCard.vue';
import SchedulePreview from '../components/SchedulePreview.vue';
import StatTile from '../components/StatTile.vue';
import {
  targetSchedulerApi,
  getStoredPort,
  setStoredPort,
  getStoredProfileId,
  setStoredProfileId,
  getStoredHeaderCollapsed,
  setStoredHeaderCollapsed,
  getStoredHasConnected,
  setStoredHasConnected,
} from '../services/targetSchedulerApi';
import { THEME } from '../theme';
import { fuzzyMatch } from '../fuzzyMatch';
import {
  computeSummary,
  computeRollup,
  classifyTargetCompletion,
  collectFilterNames,
  sortProjects,
  projectsToMarkdown,
} from '../calculations';

const { t } = useI18n();
const toastStore = useToastStore();

const port = ref(getStoredPort());
const profiles = ref([]);
const selectedProfileId = ref('');
const projects = ref(null);
const targetsByProject = ref({});
const loading = ref(false);
const error = ref('');
const lastUpdated = ref(null);

const showSchedule = ref(false);
const schedule = ref(null);
const scheduleLoading = ref(false);
const scheduleError = ref('');

const apiVersion = ref('');

const headerCollapsed = ref(getStoredHeaderCollapsed());
const hasConnectedBefore = ref(getStoredHasConnected());
function toggleHeader() {
  headerCollapsed.value = !headerCollapsed.value;
  setStoredHeaderCollapsed(headerCollapsed.value);
}

const FILTER_PREFS_KEY = 'tsviewer.filterPrefs';
function loadFilterPrefs() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_PREFS_KEY)) || {};
  } catch {
    return {};
  }
}
const savedFilterPrefs = loadFilterPrefs();

const searchQuery = ref('');
const stateFilter = ref(savedFilterPrefs.stateFilter || 'all');
const completionFilter = ref(savedFilterPrefs.completionFilter || 'all');
const filterNameFilter = ref(savedFilterPrefs.filterNameFilter || 'all');
const mosaicFilter = ref(savedFilterPrefs.mosaicFilter || 'all');
const scheduledTonightOnly = ref(savedFilterPrefs.scheduledTonightOnly || false);
const sortKey = ref(savedFilterPrefs.sortKey || 'name');
const sortDir = ref(savedFilterPrefs.sortDir || 'asc');
const filtersExpanded = ref(savedFilterPrefs.filtersExpanded || false);

watch(
  [
    stateFilter,
    completionFilter,
    filterNameFilter,
    mosaicFilter,
    scheduledTonightOnly,
    sortKey,
    sortDir,
    filtersExpanded,
  ],
  () => {
    try {
      localStorage.setItem(
        FILTER_PREFS_KEY,
        JSON.stringify({
          stateFilter: stateFilter.value,
          completionFilter: completionFilter.value,
          filterNameFilter: filterNameFilter.value,
          mosaicFilter: mosaicFilter.value,
          scheduledTonightOnly: scheduledTonightOnly.value,
          sortKey: sortKey.value,
          sortDir: sortDir.value,
          filtersExpanded: filtersExpanded.value,
        })
      );
    } catch {
      // ignore storage failures (e.g. private browsing)
    }
  }
);

const availableStates = computed(() => {
  if (!projects.value) return [];
  return [...new Set(projects.value.map((p) => p.State))];
});

const availableFilterNames = computed(() => {
  const allTargets = Object.values(targetsByProject.value).flatMap((p) => p.targets);
  return collectFilterNames(allTargets);
});

const scheduledTargetIds = computed(() => {
  if (!schedule.value) return null;
  return new Set(schedule.value.filter((s) => s.Id).map((s) => s.Id));
});

// A target counts for a project's visibility when it satisfies the
// completion, filter-name, "scheduled tonight" and search criteria — these
// are all inherently about individual targets, so (unlike search alone)
// they never fall back to "the project name matched, show everything".
function targetMatchesFilters(target, query, completion, filterName, tonightIds) {
  if (completion !== 'all' && classifyTargetCompletion(target) !== completion) return false;
  if (filterName !== 'all' && !(target.ExposurePlan || []).some((p) => p.FilterName === filterName))
    return false;
  if (tonightIds && !tonightIds.has(target.Id)) return false;
  if (query && !fuzzyMatch(target.Name, query)) return false;
  return true;
}

function projectMatchesFilters(project, targets, query, completion, filterName, tonightIds) {
  if (targets.some((t) => targetMatchesFilters(t, query, completion, filterName, tonightIds)))
    return true;
  if (completion !== 'all' || filterName !== 'all' || tonightIds) return false;
  if (!query) return true;
  return fuzzyMatch(project.Name, query);
}

const projectRollups = computed(() => {
  if (!projects.value) return {};
  return Object.fromEntries(
    projects.value.map((p) => [p.Id, computeRollup(targetsByProject.value[p.Id]?.targets || [])])
  );
});

const visibleProjects = computed(() => {
  if (!projects.value) return [];
  const query = searchQuery.value.trim();
  const tonightIds = scheduledTonightOnly.value ? scheduledTargetIds.value : null;
  const filtered = projects.value.filter((project) => {
    if (stateFilter.value !== 'all' && project.State !== stateFilter.value) return false;
    if (mosaicFilter.value === 'mosaic' && !project.Mosaic) return false;
    if (mosaicFilter.value === 'single' && project.Mosaic) return false;
    const targets = targetsByProject.value[project.Id]?.targets || [];
    return projectMatchesFilters(
      project,
      targets,
      query,
      completionFilter.value,
      filterNameFilter.value,
      tonightIds
    );
  });
  return sortProjects(filtered, projectRollups.value, sortKey.value, sortDir.value);
});

const POLL_MS = 30000;

async function loadProfiles(signal) {
  profiles.value = await targetSchedulerApi.getProfiles({ signal });
  const storedId = getStoredProfileId();
  const remembered = storedId && profiles.value.find((p) => p.Id === storedId);
  const fallback = profiles.value.find((p) => p.Active) || profiles.value[0];
  const chosen = remembered || fallback;
  if (chosen) selectedProfileId.value = chosen.Id;
}

targetSchedulerApi
  .getVersion()
  .then((v) => {
    apiVersion.value = String(v);
  })
  .catch(() => {});

async function loadProjects(signal) {
  if (!selectedProfileId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const fetchedProjects = await targetSchedulerApi.getProjects(selectedProfileId.value, {
      signal,
    });
    projects.value = fetchedProjects;

    const entries = await Promise.all(
      fetchedProjects.map(async (project) => {
        try {
          const targets = await targetSchedulerApi.getTargets(project.Id, { signal });
          return [project.Id, { targets, error: '' }];
        } catch (e) {
          return [project.Id, { targets: [], error: e.message }];
        }
      })
    );
    targetsByProject.value = Object.fromEntries(entries);
    lastUpdated.value = new Date();
    hasConnectedBefore.value = true;
    setStoredHasConnected();
  } catch (e) {
    // A cancellation must propagate to the caller (onPortChange reverts the
    // port field on cancel) rather than being swallowed as a normal error.
    if (e.kind === 'cancelled') throw e;
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

// Every connection attempt — the initial auto-connect on mount, a manual
// Refresh, a port change, and a profile change — goes through this single
// cancellable path. They used to be separate code paths (refreshAll,
// onPortChange, onProfileChange each doing their own fetches), which meant
// e.g. changing the port while the initial mount's auto-connect was still
// in flight left two uncoordinated requests running at once — whichever
// resolved last silently overwrote the other's result (e.g. the initial
// attempt against the old port finishing after a port change and stomping
// the new, correct state). The same race existed between a port change and
// a profile change. Routing everything through one AbortController means a
// new attempt always cancels whatever came before it.
const connectingPort = ref(false);
let portAbortController = null;
let lastGoodPort = getStoredPort();
let lastGoodProfileId = '';

async function connect({ isPortChange = false, isProfileChange = false } = {}) {
  const attemptedPort = port.value;
  const attemptedProfileId = selectedProfileId.value;
  portAbortController?.abort();
  const controller = new AbortController();
  portAbortController = controller;

  connectingPort.value = true;
  loading.value = true;
  error.value = '';
  if (isPortChange) {
    setStoredPort(attemptedPort);
    profiles.value = [];
    selectedProfileId.value = '';
  }
  if (isPortChange || isProfileChange) {
    if (isProfileChange) setStoredProfileId(attemptedProfileId);
    projects.value = null;
    targetsByProject.value = {};
    lastUpdated.value = null;
    schedule.value = null;
  }

  try {
    if (!profiles.value.length) await loadProfiles(controller.signal);
    await loadProjects(controller.signal);
    // A newer connect() call may have superseded this one while the above
    // awaits were in flight (it aborts this controller, but this function
    // keeps running until it next hits an await/throw) — a stale attempt
    // must never touch state the newer attempt now owns. loadSchedule()
    // isn't itself signal-aware, so skip even starting it once stale.
    if (portAbortController !== controller) return;
    if (showSchedule.value) await loadSchedule();
    if (portAbortController !== controller) return;
    lastGoodPort = attemptedPort;
    lastGoodProfileId = selectedProfileId.value;
  } catch (e) {
    if (portAbortController !== controller) return; // stale — ignore entirely
    if (controller.signal.aborted) {
      if (isPortChange) {
        port.value = lastGoodPort;
        setStoredPort(lastGoodPort);
      }
      if (isProfileChange && lastGoodProfileId) {
        selectedProfileId.value = lastGoodProfileId;
        setStoredProfileId(lastGoodProfileId);
      }
    } else {
      error.value = e.message;
    }
  } finally {
    if (portAbortController === controller) {
      loading.value = false;
      connectingPort.value = false;
      portAbortController = null;
    }
  }
}

function onPortChange() {
  connect({ isPortChange: true });
}

function onProfileChange() {
  connect({ isProfileChange: true });
}

function cancelPortConnect() {
  portAbortController?.abort();
}

function refreshAll() {
  connect();
}

async function loadSchedule() {
  if (!selectedProfileId.value) return;
  scheduleLoading.value = true;
  scheduleError.value = '';
  try {
    schedule.value = await targetSchedulerApi.getPreview(selectedProfileId.value);
  } catch (e) {
    scheduleError.value = e.message;
  } finally {
    scheduleLoading.value = false;
  }
}

function toggleSchedule() {
  showSchedule.value = !showSchedule.value;
  if (showSchedule.value) loadSchedule();
}

// "Scheduled tonight" needs the preview data regardless of whether the
// schedule panel itself is open.
function onScheduledTonightToggle() {
  if (scheduledTonightOnly.value && !schedule.value) loadSchedule();
}

const summary = computed(() => computeSummary(projects.value, targetsByProject.value));

async function exportMarkdown() {
  const md = projectsToMarkdown(visibleProjects.value, targetsByProject.value, {
    profileName: profiles.value.find((p) => p.Id === selectedProfileId.value)?.Name,
  });
  try {
    await navigator.clipboard.writeText(md);
    toastStore.showToast({
      type: 'success',
      title: t('plugins.targetSchedulerViewer.labels.exportCopiedTitle'),
      message: t('plugins.targetSchedulerViewer.labels.exportCopiedMessage'),
    });
  } catch {
    toastStore.showToast({
      type: 'error',
      title: t('plugins.targetSchedulerViewer.labels.exportFailedTitle'),
      message: t('plugins.targetSchedulerViewer.labels.exportFailedMessage'),
    });
  }
}

// Background/foreground-aware: pauses while the app is backgrounded and
// tears itself down on unmount. Routed through connect() (via refreshAll())
// rather than loadProjects()/loadSchedule() directly, so a poll tick that
// fires mid-connect (a port or profile change still in flight) hits the same
// stale-attempt guard used everywhere else in this file, instead of racing it.
const pluginActive = ref(true);
useBackgroundAwarePolling(refreshAll, POLL_MS, pluginActive, { immediate: true });

onUnmounted(() => {
  pluginActive.value = false;
  portAbortController?.abort();
});
</script>

<template>
  <div class="p-3 md:p-5 bg-ground text-content">
    <div class="mx-auto max-w-5xl space-y-4">
      <section class="tns-card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold md:text-2xl">
              {{ t('plugins.targetSchedulerViewer.title') }}
            </h1>
            <p class="text-xs text-content-faint">
              {{ t('plugins.targetSchedulerViewer.subtitle') }}
            </p>
          </div>
          <div class="flex gap-2">
            <button class="tns-btn-secondary w-auto! px-3!" @click="toggleSchedule">
              {{
                showSchedule
                  ? t('plugins.targetSchedulerViewer.actions.hideSchedule')
                  : t('plugins.targetSchedulerViewer.actions.showSchedule')
              }}
            </button>
            <button class="tns-btn-secondary w-auto! px-3!" :disabled="loading" @click="refreshAll">
              {{
                loading
                  ? t('plugins.targetSchedulerViewer.actions.refreshing')
                  : t('plugins.targetSchedulerViewer.actions.refresh')
              }}
            </button>
            <button
              class="tns-btn-ghost"
              :aria-label="
                headerCollapsed
                  ? t('plugins.targetSchedulerViewer.actions.expandHeader')
                  : t('plugins.targetSchedulerViewer.actions.collapseHeader')
              "
              @click="toggleHeader"
            >
              <svg
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': headerCollapsed }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4.5 15.75l7.5-7.5 7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="headerCollapsed" class="mt-2 text-xs text-content-faint">
          {{ profiles.find((p) => p.Id === selectedProfileId)?.Name }}
          <span v-if="summary">
            · {{ summary.completionPct }}% complete · {{ summary.targetCount }} targets</span
          >
        </p>

        <div
          class="grid transition-[grid-template-rows] duration-200 ease-out"
          :style="{ gridTemplateRows: headerCollapsed ? '0fr' : '1fr' }"
        >
          <div class="overflow-hidden">
            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="text-xs text-content-faint">
                {{ t('plugins.targetSchedulerViewer.labels.apiPort') }}
                <div class="mt-1 flex items-center gap-2">
                  <input
                    v-model="port"
                    type="text"
                    inputmode="numeric"
                    class="tns-input h-12"
                    @change="onPortChange"
                  />
                  <svg
                    v-if="connectingPort"
                    class="h-4 w-4 shrink-0 animate-spin text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <button
                    v-if="connectingPort"
                    type="button"
                    class="tns-btn-danger w-auto! shrink-0 px-3!"
                    @click="cancelPortConnect"
                  >
                    {{ t('plugins.targetSchedulerViewer.actions.cancel') }}
                  </button>
                </div>
              </label>

              <label class="text-xs text-content-faint">
                {{ t('plugins.targetSchedulerViewer.labels.profile') }}
                <select
                  v-model="selectedProfileId"
                  class="tns-select mt-1 h-12"
                  @change="onProfileChange"
                >
                  <option v-for="p in profiles" :key="p.Id" :value="p.Id">
                    {{ p.Name
                    }}{{ p.Active ? ` (${t('plugins.targetSchedulerViewer.labels.active')})` : '' }}
                  </option>
                </select>
              </label>
            </div>

            <div
              v-if="summary"
              class="mt-4 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-5 border-line"
            >
              <StatTile
                :label="t('plugins.targetSchedulerViewer.labels.activeProjects')"
                :value="summary.activeProjects"
              />
              <StatTile
                :label="t('plugins.targetSchedulerViewer.labels.targets')"
                :value="summary.targetCount"
              />
              <StatTile
                :label="t('plugins.targetSchedulerViewer.labels.completion')"
                :value="summary.completionPct + '%'"
                accent
              />
              <StatTile
                :label="t('plugins.targetSchedulerViewer.labels.integrationTime')"
                :value="summary.integrationTime"
              />
              <StatTile
                :label="t('plugins.targetSchedulerViewer.labels.remainingTime')"
                :value="summary.remainingIntegrationTime"
              />
            </div>

            <p v-if="lastUpdated" class="mt-3 text-[11px] text-content-faint">
              {{ t('plugins.targetSchedulerViewer.labels.lastUpdated') }}:
              {{ lastUpdated.toLocaleTimeString() }}
            </p>
          </div>
        </div>
      </section>

      <template v-if="showSchedule">
        <div
          v-if="scheduleError"
          class="rounded-lg border border-status-danger bg-status-danger/15 p-3 text-sm text-status-danger"
        >
          <p>{{ scheduleError }}</p>
          <a
            href="https://tcpalmer.github.io/nina-scheduler/adv-topics/api.html"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-block underline"
          >
            {{ t('plugins.targetSchedulerViewer.labels.apiDocsLink') }}
          </a>
        </div>
        <div
          v-else-if="scheduleLoading && !schedule"
          class="h-16 animate-pulse rounded-lg bg-surface-1"
        />
        <SchedulePreview v-else-if="schedule" :segments="schedule" />
      </template>

      <div v-if="!hasConnectedBefore" class="tns-card border-t-2 border-t-accent text-sm">
        <p class="mb-2 flex items-center gap-2 text-base font-semibold text-content">
          <svg
            class="h-5 w-5 shrink-0 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0Zm-9-3.75h.008v.008H12V8.25Z"
            />
          </svg>
          {{ t('plugins.targetSchedulerViewer.labels.welcomeTitle') }}
        </p>
        <p class="mb-3 text-content-muted">
          {{ t('plugins.targetSchedulerViewer.labels.welcomeSubtitle') }}
        </p>
        <p class="mb-1 font-medium text-content">
          {{ t('plugins.targetSchedulerViewer.labels.setupTitle') }}
        </p>
        <ol class="ml-1 list-inside list-decimal space-y-1 text-content-muted">
          <li>{{ t('plugins.targetSchedulerViewer.labels.setupStep1') }}</li>
          <li>{{ t('plugins.targetSchedulerViewer.labels.setupStep2') }}</li>
          <li>{{ t('plugins.targetSchedulerViewer.labels.setupStep3') }}</li>
        </ol>
        <a
          href="https://tcpalmer.github.io/nina-scheduler/adv-topics/api.html"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-3 inline-block underline text-accent"
        >
          {{ t('plugins.targetSchedulerViewer.labels.apiDocsLink') }}
        </a>

        <p
          v-if="loading && !error"
          class="mt-3 flex items-center gap-2 border-t pt-2 text-[11px] border-line text-content-faint"
        >
          <svg class="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {{ t('plugins.targetSchedulerViewer.labels.welcomeTrying', { port }) }}
        </p>
        <p v-else-if="error" class="mt-3 border-t pt-2 text-[11px] border-line text-content-faint">
          {{ error }}
        </p>
      </div>

      <div
        v-else-if="error"
        class="flex items-start gap-2 rounded-lg border border-status-danger bg-status-danger/15 p-3 text-sm text-status-danger"
      >
        <svg
          class="mt-0.5 h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <div>
          <p>{{ error }}</p>
          <a
            href="https://tcpalmer.github.io/nina-scheduler/adv-topics/api.html"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-block underline"
          >
            {{ t('plugins.targetSchedulerViewer.labels.apiDocsLink') }}
          </a>
        </div>
      </div>

      <div v-else-if="loading && !projects" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-surface-1" />
      </div>

      <div
        v-else-if="projects && !projects.length"
        class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm border-line text-content-faint"
      >
        <svg
          class="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
        {{ t('plugins.targetSchedulerViewer.labels.noProjects') }}
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[220px] flex-1">
            <svg
              class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z"
              />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('plugins.targetSchedulerViewer.labels.searchPlaceholder')"
              class="tns-input pl-8 pr-8 text-sm"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-content-faint"
              :aria-label="t('plugins.targetSchedulerViewer.labels.clearSearch')"
              @click="searchQuery = ''"
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            class="tns-btn-secondary relative w-auto! shrink-0 px-3! text-[11px]"
            :class="{ 'border-accent text-content': filtersExpanded }"
            @click="filtersExpanded = !filtersExpanded"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
              />
            </svg>
            {{ t('plugins.targetSchedulerViewer.labels.filtersToggle') }}
            <span
              v-if="
                stateFilter !== 'all' ||
                completionFilter !== 'all' ||
                filterNameFilter !== 'all' ||
                mosaicFilter !== 'all' ||
                scheduledTonightOnly
              "
              class="h-1.5 w-1.5 rounded-full bg-accent"
            />
          </button>

          <button
            class="tns-btn-secondary w-auto! shrink-0 px-3! text-[11px]"
            :disabled="!visibleProjects.length"
            @click="exportMarkdown"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
              />
            </svg>
            {{ t('plugins.targetSchedulerViewer.labels.exportMarkdown') }}
          </button>
        </div>

        <div
          class="grid transition-[grid-template-rows] duration-200 ease-out"
          :style="{ gridTemplateRows: filtersExpanded ? '1fr' : '0fr' }"
        >
          <div class="space-y-2 overflow-hidden">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-content-faint">{{
                t('plugins.targetSchedulerViewer.labels.stateFilterLabel')
              }}</span>
              <button
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  stateFilter === 'all'
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="stateFilter = 'all'"
              >
                {{ t('plugins.targetSchedulerViewer.labels.allStates') }}
              </button>
              <button
                v-for="s in availableStates"
                :key="s"
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  stateFilter === s
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="stateFilter = s"
              >
                {{ s }}
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-content-faint">{{
                t('plugins.targetSchedulerViewer.labels.completionFilterLabel')
              }}</span>
              <button
                v-for="opt in [
                  ['all', t('plugins.targetSchedulerViewer.labels.allStates')],
                  ['not-started', t('plugins.targetSchedulerViewer.labels.notStarted')],
                  ['in-progress', t('plugins.targetSchedulerViewer.labels.inProgress')],
                  ['done', t('plugins.targetSchedulerViewer.labels.done')],
                ]"
                :key="opt[0]"
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  completionFilter === opt[0]
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="completionFilter = opt[0]"
              >
                {{ opt[1] }}
              </button>
            </div>

            <div v-if="availableFilterNames.length" class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-content-faint">{{
                t('plugins.targetSchedulerViewer.labels.filterNameFilterLabel')
              }}</span>
              <button
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  filterNameFilter === 'all'
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="filterNameFilter = 'all'"
              >
                {{ t('plugins.targetSchedulerViewer.labels.allStates') }}
              </button>
              <button
                v-for="f in availableFilterNames"
                :key="f"
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  filterNameFilter === f
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="filterNameFilter = f"
              >
                {{ f }}
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-content-faint">{{
                t('plugins.targetSchedulerViewer.labels.mosaicFilterLabel')
              }}</span>
              <button
                v-for="opt in [
                  ['all', t('plugins.targetSchedulerViewer.labels.allStates')],
                  ['mosaic', t('plugins.targetSchedulerViewer.labels.mosaicOnly')],
                  ['single', t('plugins.targetSchedulerViewer.labels.singlePanelOnly')],
                ]"
                :key="opt[0]"
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  mosaicFilter === opt[0]
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="mosaicFilter = opt[0]"
              >
                {{ opt[1] }}
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-content-faint">{{
                t('plugins.targetSchedulerViewer.labels.scheduledFilterLabel')
              }}</span>
              <button
                v-for="opt in [
                  [false, t('plugins.targetSchedulerViewer.labels.allStates')],
                  [true, t('plugins.targetSchedulerViewer.labels.scheduledTonightOnly')],
                ]"
                :key="opt[0]"
                class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                :style="
                  scheduledTonightOnly === opt[0]
                    ? {
                        borderColor: THEME.accent,
                        backgroundColor: THEME.goodBg,
                        color: THEME.inkPrimary,
                      }
                    : { borderColor: THEME.border, color: THEME.inkMuted }
                "
                @click="
                  scheduledTonightOnly = opt[0];
                  onScheduledTonightToggle();
                "
              >
                {{ opt[1] }}
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-content-faint">{{
                t('plugins.targetSchedulerViewer.labels.sortLabel')
              }}</span>
              <select v-model="sortKey" class="tns-select w-auto! px-2! text-[11px]">
                <option value="name">
                  {{ t('plugins.targetSchedulerViewer.labels.sortName') }}
                </option>
                <option value="priority">
                  {{ t('plugins.targetSchedulerViewer.labels.sortPriority') }}
                </option>
                <option value="completion">
                  {{ t('plugins.targetSchedulerViewer.labels.sortCompletion') }}
                </option>
                <option value="remaining">
                  {{ t('plugins.targetSchedulerViewer.labels.sortRemaining') }}
                </option>
              </select>
              <button
                class="flex h-7 items-center gap-1 rounded border px-2 text-[11px] transition-colors border-line text-content-faint"
                :aria-label="
                  sortDir === 'asc'
                    ? t('plugins.targetSchedulerViewer.labels.sortAscending')
                    : t('plugins.targetSchedulerViewer.labels.sortDescending')
                "
                @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
              >
                <svg
                  class="h-3.5 w-3.5 transition-transform"
                  :class="{ 'rotate-180': sortDir === 'desc' }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4.5 15.75l7.5-7.5 7.5 7.5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="!visibleProjects.length"
          class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm border-line text-content-faint"
        >
          {{ t('plugins.targetSchedulerViewer.labels.noResults') }}
        </div>

        <div v-else class="space-y-3">
          <ProjectCard
            v-for="project in visibleProjects"
            :key="project.Id"
            :project="project"
            :targets="targetsByProject[project.Id]?.targets || []"
            :targets-error="targetsByProject[project.Id]?.error || ''"
            :search-query="searchQuery.trim()"
            :completion-filter="completionFilter"
            :filter-name-filter="filterNameFilter"
            :scheduled-target-ids="scheduledTonightOnly ? scheduledTargetIds : null"
          />
        </div>
      </template>

      <div class="space-y-3 rounded-lg p-3 bg-surface-1">
        <p class="text-[11px] font-medium text-content-muted">
          {{ t('plugins.targetSchedulerViewer.labels.legendTitle') }}
        </p>

        <div>
          <p class="mb-1 text-[10px] uppercase tracking-wide text-content-faint">
            {{ t('plugins.targetSchedulerViewer.labels.legendBarsTitle') }}
          </p>
          <p class="flex flex-wrap items-center gap-3 text-[11px] text-content-faint">
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-status-ok" />
              {{ t('plugins.targetSchedulerViewer.labels.legendAccepted') }}
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-status-warn" />
              {{ t('plugins.targetSchedulerViewer.labels.legendPending') }}
            </span>
          </p>
        </div>

        <div>
          <p class="mb-1 text-[10px] uppercase tracking-wide text-content-faint">
            {{ t('plugins.targetSchedulerViewer.labels.legendDotsTitle') }}
          </p>
          <p class="flex flex-wrap items-center gap-3 text-[11px] text-content-faint">
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-status-ok" />
              {{ t('plugins.targetSchedulerViewer.labels.legendActive') }}
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-status-warn" />
              {{ t('plugins.targetSchedulerViewer.labels.legendInactive') }}
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-accent" />
              {{ t('plugins.targetSchedulerViewer.labels.legendDraft') }}
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-full bg-status-danger" />
              {{ t('plugins.targetSchedulerViewer.labels.legendClosed') }}
            </span>
          </p>
        </div>
      </div>

      <footer class="space-y-1 pt-2 text-[11px] text-content-faint">
        <p>{{ t('plugins.targetSchedulerViewer.labels.unofficialDisclaimer') }}</p>
        <p>
          {{ t('plugins.targetSchedulerViewer.labels.dataFrom') }}
          <a
            href="https://tcpalmer.github.io/nina-scheduler/"
            target="_blank"
            rel="noopener noreferrer"
            class="underline text-accent"
            >Target Scheduler</a
          >
          <span v-if="apiVersion"> v{{ apiVersion }}</span>
          — {{ t('plugins.targetSchedulerViewer.labels.readOnlyNote') }}
        </p>
        <p>
          {{ t('plugins.targetSchedulerViewer.labels.creditNote') }}
          <a
            href="https://github.com/tcpalmer"
            target="_blank"
            rel="noopener noreferrer"
            class="underline text-accent"
            >tcpalmer</a
          >.
        </p>
      </footer>
    </div>
  </div>
</template>
