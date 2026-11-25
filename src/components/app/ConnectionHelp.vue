<template>
  <!-- What is wrong and what to do, while the backend does not answer -->
  <section
    class="tns-card w-full max-w-lg flex flex-col gap-3 text-left"
    data-testid="connection-help"
  >
    <div class="flex items-start gap-3" role="status">
      <Spinner
        v-if="isWaiting"
        size="sm"
        class="mt-1"
        :class="diagnosis === 'searching' ? 'text-accent' : 'text-status-ok'"
      />
      <ExclamationTriangleIcon v-else class="w-6 h-6 shrink-0 text-status-warn" />
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <h2 class="text-lg font-semibold text-content leading-tight wrap-break-word">
          {{ title }}
        </h2>
        <p class="text-sm text-content-muted wrap-break-word">{{ text }}</p>
      </div>
    </div>

    <!-- Another rig or computer: never taken over without asking -->
    <div v-if="diagnosis === 'found'" class="flex flex-col gap-2">
      <button
        v-for="entry in found"
        :key="`${entry.host}:${entry.port}`"
        type="button"
        class="tns-btn-primary flex-col py-2"
        @click="connect(entry)"
      >
        <span>{{ $t('app.connection_help.found.connect', { name: entry.label }) }}</span>
        <span class="text-xs font-normal opacity-80">{{ entry.host }}</span>
      </button>
    </div>

    <template v-for="section in sections" :key="section.id">
      <h3 v-if="sections.length > 1" class="tns-section-title">
        {{ $t(`app.connection_help.sections.${section.id}`) }}
      </h3>
      <ol class="flex flex-col gap-2 list-decimal pl-5 text-sm text-content">
        <li v-for="check in section.checks" :key="check" class="wrap-break-word">
          {{ $t(`app.connection_help.checks.${check}`, { name: hotspotName, port }) }}
        </li>
      </ol>
    </template>

    <template v-if="diagnosis !== 'searching'">
      <button
        type="button"
        class="tns-btn-secondary gap-2"
        data-testid="connection-search"
        @click="retry"
      >
        <Spinner v-if="searching" size="sm" />
        {{ $t('app.connection_help.searchAgain') }}
      </button>
      <p class="text-xs text-content-faint">{{ $t('app.connection_help.keepsTrying') }}</p>
    </template>

    <button
      type="button"
      class="w-full min-h-touch flex items-center gap-2 text-left text-sm text-content-muted"
      :aria-expanded="showAdvanced"
      @click="showAdvanced = !showAdvanced"
    >
      <ChevronRightIcon
        class="w-4 h-4 shrink-0 transition-transform duration-200"
        :class="{ 'rotate-90': showAdvanced }"
      />
      {{ $t('app.connection_help.advanced') }}
    </button>
    <div v-if="showAdvanced" class="flex flex-col gap-2">
      <p class="text-xs text-content-muted wrap-break-word">
        {{ $t('app.connection_splash.details', { endpoint: target, elapsed }) }}
      </p>
      <button type="button" class="tns-btn-secondary" @click="$emit('settings')">
        {{ $t('app.connection_help.changeAddress') }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { Capacitor } from '@capacitor/core';
import { ChevronRightIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import Spinner from '@/components/helpers/Spinner.vue';
import { useConnectionHelp } from '@/composables/useConnectionHelp';
import { apiStore } from '@/store/store';

const props = defineProps({
  // Seconds without a connection
  elapsed: { type: Number, required: true },
  // host:port the app tries to reach
  target: { type: String, required: true },
});
const emit = defineEmits(['retry', 'settings']);

const { t } = useI18n();
const store = apiStore();
const showAdvanced = ref(false);

const active = computed(() => !store.isBackendReachable);
const { diagnosis, kind, instance, found, refused, searching, search, connect } = useConnectionHelp(
  {
    active,
    elapsed: toRef(props, 'elapsed'),
  }
);

// Nothing for the user to do yet
const isWaiting = computed(() => ['searching', 'pinsStarting'].includes(diagnosis.value));
const name = computed(() => instance.value?.name || instance.value?.rigId || '');
const hotspotName = computed(() => instance.value?.rigId || 'pins-…');
const port = computed(() => props.target.split(':').pop());

const updatePlugin = computed(() =>
  store.connectionIssue?.type === 'apiVersion' ? 'Advanced API' : "Touch'N'Stars"
);
const title = computed(() => {
  if (diagnosis.value === 'searching') {
    return name.value
      ? t('app.connection_help.searching.titleNamed', { name: name.value })
      : t('app.connection_help.searching.title');
  }
  return t(`app.connection_help.${diagnosis.value}.title`);
});
const text = computed(() =>
  t(`app.connection_help.${diagnosis.value}.text`, {
    plugin: updatePlugin.value,
    current: store.connectionIssue?.current ?? '–',
    minimum: store.connectionIssue?.minimum ?? '–',
  })
);

const RIG_CHECKS = ['power', 'hotspot', 'home'];
const NINA_CHECKS = ['computer', 'network', 'plugin', 'firewall'];
// What the phone or browser itself can stand in the way with
const deviceChecks = computed(() => {
  if (Capacitor.getPlatform() === 'ios') return ['iosLocalNetwork'];
  if (refused.value) return ['nearbyDevices'];
  return Capacitor.isNativePlatform() ? [] : ['browser'];
});
const sections = computed(() => {
  // A find that is not the right one leaves the question why the own backend is silent.
  const silence = { pins: 'rigSilent', nina: 'ninaSilent', unknown: 'silent' }[kind.value];
  switch (diagnosis.value === 'found' ? silence : diagnosis.value) {
    case 'rigSilent':
      return [{ id: 'rig', checks: [...RIG_CHECKS, ...deviceChecks.value] }];
    case 'ninaSilent':
      return [{ id: 'nina', checks: [...NINA_CHECKS, ...deviceChecks.value] }];
    case 'silent':
      return [
        { id: 'rig', checks: [...RIG_CHECKS, ...deviceChecks.value] },
        { id: 'nina', checks: NINA_CHECKS },
      ];
    default:
      return [];
  }
});

function retry() {
  emit('retry');
  search();
}
</script>
