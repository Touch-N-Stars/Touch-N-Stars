<template>
  <div class="tns-card relative overflow-hidden">
    <div class="flex flex-row items-center justify-between gap-3">
      <div class="absolute top-0 right-20 p-4 opacity-10 pointer-events-none">
        <svg class="w-16 h-16 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      </div>
      <div class="relative z-10 min-w-0">
        <h3 class="tns-section-title mb-1">{{ $t('plugins.pins.sambaTitle') }}</h3>
        <p class="text-content-muted text-sm">{{ $t('plugins.pins.sambaDescription') }}</p>
      </div>
      <div class="relative z-10 shrink-0">
        <toggleButton
          :status-value="enabled"
          @update:status-value="$emit('toggle', $event)"
          :disabled="disabled"
        />
      </div>
    </div>

    <p v-if="!enabled" class="relative z-10 mt-2 text-xs text-content-muted">
      {{ $t('plugins.pins.samba.firstEnable') }}
    </p>
    <div v-else class="relative z-10 mt-3 flex flex-col gap-2 text-sm text-content">
      <p>{{ $t('plugins.pins.samba.howTo') }}</p>
      <dl class="flex flex-col gap-2">
        <div v-for="row in addressRows" :key="row.label" class="rounded-control bg-surface-2 p-3">
          <dt class="text-xs text-content-muted">{{ row.label }}</dt>
          <dd class="font-mono break-all select-text">{{ row.value }}</dd>
        </div>
      </dl>
      <p class="text-xs text-content-muted">
        {{ $t('plugins.pins.samba.login', { user: SAMBA_USER, password: SAMBA_DEFAULT_PASSWORD }) }}
      </p>
      <p v-if="addresses.outside" class="text-xs text-status-warn break-words">
        {{ $t('plugins.pins.samba.outside', { folder: imageFolder, share: SAMBA_SHARE_FOLDER }) }}
      </p>
      <p class="text-xs text-status-warn">{{ $t('plugins.pins.samba.openAccess') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import {
  SAMBA_DEFAULT_PASSWORD,
  SAMBA_SHARE_FOLDER,
  SAMBA_USER,
  sambaAddresses,
} from '@/utils/sambaShare';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();

// The address the app itself uses; the browser served by the rig has none in the settings.
const host = computed(() => settingsStore.connection.ip || window.location.hostname);
const imageFolder = computed(() => store.profileInfo?.ImageFileSettings?.FilePath ?? '');
const addresses = computed(() => sambaAddresses(host.value, imageFolder.value));
const addressRows = computed(() => [
  { label: t('plugins.pins.samba.windows'), value: addresses.value.windows },
  { label: t('plugins.pins.samba.mac'), value: addresses.value.mac },
]);

defineProps({
  enabled: {
    type: Boolean,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggle']);
</script>
