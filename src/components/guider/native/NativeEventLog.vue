<template>
  <div class="tns-card p-3! flex flex-col gap-2 min-w-0">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-bold text-content">{{ t('components.guider.native.log.title') }}</h3>
      <div class="ml-auto flex rounded-control border border-line-strong overflow-hidden">
        <button
          v-for="option in FILTERS"
          :key="option"
          type="button"
          class="px-2.5 min-h-touch text-xs font-semibold"
          :class="
            filter === option ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-content-muted'
          "
          @click="filter = option"
        >
          {{ t(`components.guider.native.log.filter_${option}`) }}
        </button>
      </div>
    </div>

    <p v-if="!visible.length" class="text-sm text-content-faint py-4 text-center">
      {{ t('components.guider.native.log.empty') }}
    </p>

    <ul class="flex flex-col gap-1.5 overflow-y-auto" :style="{ maxHeight }">
      <li
        v-for="{ alert, key } in visible"
        :key="key"
        class="rounded-control border px-2.5 py-2"
        :class="rowClass(alert)"
      >
        <div class="flex items-start gap-2">
          <button
            type="button"
            class="min-w-0 flex-1 flex items-start gap-2 text-left"
            data-haptic="none"
            :aria-expanded="openKey === key"
            @click="toggle(key)"
          >
            <component
              :is="iconFor(alert)"
              class="w-5 h-5 shrink-0 mt-0.5"
              :class="TONE_TEXT[severityTone(alert.severity)]"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2">
                <span class="text-sm font-semibold text-content truncate">
                  {{ textOf(alert).title }}
                </span>
                <span class="ml-auto text-[11px] text-content-faint tabular-nums shrink-0">
                  {{ formatTime(alert.timestamp) }}
                </span>
              </div>
              <p v-if="alert.detail && openKey !== key" class="text-xs text-content-muted truncate">
                {{ alert.detail }}
              </p>
              <p
                v-if="textOf(alert).fix && openKey !== key"
                class="text-xs text-accent/90 truncate"
              >
                {{ t('components.guider.native.log.fix') }}: {{ textOf(alert).fix }}
              </p>
            </div>
          </button>
          <!-- Flight recorder: replay of the incident (the detail shows it too once opened) -->
          <NativeIncidentReplayButton
            v-if="alert.incidentId && openKey !== key"
            :alert="alert"
            class="shrink-0"
          />
        </div>
        <div v-if="openKey === key" class="mt-2 pl-7">
          <NativeAlertDetail :alert="alert" />
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { TONE_TEXT, alertRows, alertText, severityTone } from '@/utils/nativeGuider';
import NativeAlertDetail from './NativeAlertDetail.vue';
import NativeIncidentReplayButton from './incidents/NativeIncidentReplayButton.vue';

defineProps({
  maxHeight: { type: String, default: '28rem' },
});

const { t, te } = useI18n();
const store = useNativeGuiderStore();

/** Title, explanation and fix in the UI language (the backend's English as fallback). */
const textOf = (alert) => alertText({ t, te }, alert);

const FILTERS = ['all', 'warning', 'critical'];
const filter = ref('all');
const openKey = ref(null);

// Newest first; each row keeps its key while new alerts arrive, so an open row stays open.
const visible = computed(() => {
  const rows = alertRows(store.alerts).reverse();
  if (filter.value === 'critical') {
    return rows.filter(({ alert }) => severityTone(alert.severity) === 'danger');
  }
  if (filter.value === 'warning') {
    return rows.filter(({ alert }) => severityTone(alert.severity) !== 'info');
  }
  return rows;
});

function toggle(key) {
  openKey.value = openKey.value === key ? null : key;
}

function iconFor(alert) {
  const tone = severityTone(alert.severity);
  if (tone === 'danger') return XCircleIcon;
  if (tone === 'warn') return ExclamationTriangleIcon;
  return InformationCircleIcon;
}

function rowClass(alert) {
  const tone = severityTone(alert.severity);
  if (tone === 'danger') return 'border-status-danger/40 bg-status-danger/10';
  if (tone === 'warn') return 'border-status-warn/30 bg-status-warn/5';
  return 'border-line bg-surface-2';
}

function formatTime(timestamp) {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? new Date(ms).toLocaleTimeString() : '';
}
</script>
