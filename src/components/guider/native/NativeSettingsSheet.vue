<template>
  <div class="flex flex-col gap-3">
    <!-- Header: Basic/Advanced toggle + refresh (full sheet only) -->
    <div v-if="!namesMode" class="flex items-center gap-2">
      <div
        class="flex flex-1 rounded-control border border-line-strong bg-surface-2 p-1"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          class="flex min-h-touch flex-1 items-center justify-center rounded-chip px-3 text-sm font-semibold transition-colors"
          :class="!advanced ? 'bg-accent-action text-white' : 'text-content-muted'"
          :aria-selected="!advanced"
          @click="setAdvanced(false)"
        >
          {{ t('components.guider.native.settings.basic') }}
        </button>
        <button
          type="button"
          role="tab"
          class="flex min-h-touch flex-1 items-center justify-center rounded-chip px-3 text-sm font-semibold transition-colors"
          :class="advanced ? 'bg-accent-action text-white' : 'text-content-muted'"
          :aria-selected="advanced"
          @click="setAdvanced(true)"
        >
          {{ t('components.guider.native.settings.advanced') }}
        </button>
      </div>
      <button
        type="button"
        class="tns-btn-secondary w-auto! shrink-0 px-3!"
        :disabled="store.settingsLoading"
        :title="t('components.guider.native.settings.refresh')"
        :aria-label="t('components.guider.native.settings.refresh')"
        @click="store.loadSettings()"
      >
        <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': store.settingsLoading }" />
      </button>
    </div>

    <!-- Load error (e.g. native guider not installed or another guider connected) -->
    <div
      v-if="store.settingsError"
      class="flex items-start gap-2 rounded-control border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger"
    >
      <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
      <div class="flex min-w-0 flex-col gap-1">
        <span class="font-semibold">{{ t('components.guider.native.settings.loadFailed') }}</span>
        <span class="break-words">{{ store.settingsError }}</span>
      </div>
    </div>

    <!-- Not connected: settings still editable, camera changes apply on connect -->
    <div
      v-else-if="visibleCount && !store.settingsConnected"
      class="rounded-control border border-line bg-surface-2 p-3 text-xs text-content-muted"
    >
      {{ t('components.guider.native.settings.notConnectedHint') }}
    </div>

    <!-- A setting that only applies after a reconnect was changed while connected -->
    <div
      v-if="store.reconnectNeeded"
      class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-status-warn/40 bg-status-warn/10 p-3"
    >
      <span class="text-xs text-status-warn">
        {{ t('components.guider.native.settings.reconnectNeeded') }}
      </span>
      <button
        type="button"
        class="tns-btn-secondary w-auto! px-3! text-xs!"
        :disabled="store.reconnecting"
        @click="reconnect"
      >
        {{
          store.reconnecting
            ? t('components.guider.native.settings.reconnecting')
            : t('components.guider.native.settings.reconnectNow')
        }}
      </button>
    </div>
    <p v-if="store.reconnectError" class="text-xs text-status-danger break-words">
      {{
        t('components.guider.native.settings.reconnectFailed', { message: store.reconnectError })
      }}
    </p>

    <!-- Loading -->
    <div
      v-if="store.settingsLoading && !store.settings.length"
      class="flex items-center justify-center gap-2 p-6 text-sm text-content-muted"
    >
      <ArrowPathIcon class="h-5 w-5 animate-spin" />
      {{ t('components.guider.native.settings.loading') }}
    </div>

    <!-- Flat list of the requested settings (wizard / connect dialog) -->
    <div v-if="namesMode" class="flex flex-col divide-y divide-line">
      <NativeSettingField
        v-for="setting in namedSettings"
        :key="setting.name"
        :setting="setting"
        :compact="compact"
      />
      <div
        v-if="!store.settingsLoading && !store.settingsError && !namedSettings.length"
        class="py-3 text-sm text-content-muted"
      >
        {{ t('components.guider.native.settings.empty') }}
      </div>
    </div>

    <!-- Grouped sheet -->
    <template v-else>
      <section
        v-for="group in groups"
        :key="group.group"
        class="rounded-card border border-line bg-surface-1"
      >
        <button
          type="button"
          class="flex min-h-touch w-full items-center justify-between gap-2 px-4 text-left"
          :aria-expanded="!collapsed[group.group]"
          @click="toggleGroup(group.group)"
        >
          <span class="text-sm font-semibold uppercase tracking-wide text-content">
            {{ groupLabel(group.group) }}
            <span class="ml-1 text-xs font-normal normal-case text-content-faint">
              {{ group.settings.length }}
            </span>
          </span>
          <ChevronDownIcon
            class="h-5 w-5 shrink-0 text-content-muted transition-transform"
            :class="{ '-rotate-90': collapsed[group.group] }"
          />
        </button>
        <div v-show="!collapsed[group.group]" class="flex flex-col divide-y divide-line px-4 pb-1">
          <NativeSettingField
            v-for="setting in group.settings"
            :key="setting.name"
            :setting="setting"
            :compact="compact"
          />
        </div>
      </section>

      <div
        v-if="!store.settingsLoading && !store.settingsError && !groups.length"
        class="p-4 text-center text-sm text-content-muted"
      >
        {{ t('components.guider.native.settings.empty') }}
      </div>

      <NativeDarkLibrary v-if="!store.settingsError" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon, ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import { textOr, groupSettings, settingApplies } from '@/utils/nativeGuider';
import { readStored, writeStored } from '@/utils/safeStorage';
import NativeSettingField from '@/components/guider/native/NativeSettingField.vue';
import NativeDarkLibrary from '@/components/guider/native/NativeDarkLibrary.vue';

const props = defineProps({
  /** Render only these settings, in this order, as a flat list (wizard / connect dialog). */
  names: { type: Array, default: null },
  compact: { type: Boolean, default: false },
});

const { t, te } = useI18n();
const store = useNativeGuiderStore();

// Reconnecting disconnects the guider first: guiding stops, so ask like Stop does.
async function reconnect() {
  const ok = await useToastStore().showConfirmation(
    t('components.guider.native.settings.confirmReconnectTitle'),
    t('components.guider.native.settings.confirmReconnect'),
    t('common.confirm'),
    t('common.cancel')
  );
  if (ok) store.reconnectGuider();
}

const ADVANCED_KEY = 'nativeGuider.settings.advanced';

const advanced = ref(readStored(ADVANCED_KEY, 'false') === 'true');
const collapsed = reactive({});

const namesMode = computed(() => Array.isArray(props.names) && props.names.length > 0);

const namedSettings = computed(() => {
  if (!namesMode.value) return [];
  return props.names
    .map((name) => store.settings.find((s) => s.name === name))
    .filter((s) => s && settingApplies(s, store.settings));
});

const groups = computed(() => groupSettings(store.settings, { advanced: advanced.value }));

const visibleCount = computed(() =>
  namesMode.value
    ? namedSettings.value.length
    : groups.value.reduce((n, g) => n + g.settings.length, 0)
);

function setAdvanced(value) {
  advanced.value = value;
  writeStored(ADVANCED_KEY, value);
}

function toggleGroup(group) {
  collapsed[group] = !collapsed[group];
}

function groupLabel(group) {
  const key = `components.guider.native.settings.groups.${group}`;
  return textOr({ t, te }, key, group);
}

onMounted(() => {
  store.loadSettings();
});
</script>
