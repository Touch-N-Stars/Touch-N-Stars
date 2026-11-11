<template>
  <div class="tns-card flex flex-col gap-2 sm:gap-3">
    <h3 class="tns-section-title">
      {{ $t('components.settings.backupRestore.title') }}
    </h3>
    <p class="text-content-muted text-sm">
      {{ $t('components.settings.backupRestore.description') }}
    </p>

    <div
      class="text-status-warn text-sm bg-status-warn/10 border border-status-warn/40 rounded px-3 py-2"
    >
      {{ $t('components.settings.backupRestore.profileWarning') }}
    </div>

    <p class="text-content-muted text-sm">
      {{ saveLocationHint }}
    </p>

    <button @click="exportBackup" :disabled="busy" class="tns-btn-secondary w-full">
      {{ $t('components.settings.backupRestore.exportButton') }}
    </button>

    <label
      class="tns-btn-secondary w-full cursor-pointer"
      :class="{ 'opacity-50 pointer-events-none': busy }"
    >
      {{ $t('components.settings.backupRestore.importButton') }}
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="onFileSelected"
      />
    </label>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Capacitor } from '@capacitor/core';
import { useToastStore } from '@/store/toastStore';
import { exportSettingsBackup, importSettingsBackup } from '@/utils/settingsBackup';
import appVersion from '@/version';

const { t } = useI18n();
const toastStore = useToastStore();
const fileInput = ref(null);
const busy = ref(false);

// Mirrors the platform switch in utils/blobDownloader.js: native builds write
// to Documents/TouchNStars via Capacitor Filesystem, the browser uses its
// normal download.
const saveLocationHint = computed(() => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return t('components.settings.backupRestore.locationAndroid');
  if (platform === 'ios') return t('components.settings.backupRestore.locationIos');
  return t('components.settings.backupRestore.locationBrowser');
});

async function exportBackup() {
  busy.value = true;
  try {
    const result = await exportSettingsBackup({ appVersion });
    toastStore.showToast({
      type: 'success',
      title: t('components.settings.backupRestore.title'),
      message: t('components.settings.backupRestore.exportSuccess', {
        count: result.keyCount,
        filename: result.filename,
      }),
    });
  } catch (error) {
    console.error('Settings backup export failed:', error);
    toastStore.showToast({
      type: 'error',
      title: t('components.settings.backupRestore.title'),
      message: t('components.settings.backupRestore.exportError'),
      autoClose: false,
    });
  } finally {
    busy.value = false;
  }
}

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  // Always clear the input so re-picking the same file fires @change again.
  event.target.value = '';
  if (!file) return;

  const confirmed = await toastStore.showConfirmation(
    t('components.settings.backupRestore.confirmImportTitle'),
    t('components.settings.backupRestore.confirmImportMessage'),
    t('common.confirm'),
    t('common.cancel')
  );
  if (!confirmed) return;

  busy.value = true;
  try {
    const text = await file.text();
    const restored = importSettingsBackup(text);

    if (restored === 0) {
      // A structurally valid file that carried nothing. Reloading would look
      // like the import silently did nothing, so report it instead.
      toastStore.showToast({
        type: 'error',
        title: t('components.settings.backupRestore.title'),
        message: t('components.settings.backupRestore.importEmpty'),
        autoClose: false,
      });
      busy.value = false;
      return;
    }

    // The persistence plugin hydrates stores only on creation, and several
    // composables read their key once at module init - a reload is the only way
    // to make every restored value take effect. Same approach as the instance
    // switch in settingsStore._applyEndpointChange().
    //
    // Reload synchronously: the persistence plugin writes through a detached
    // $subscribe watcher, i.e. only on the next tick, so any store mutation in
    // a delay here would rewrite its key from the pre-import state and undo
    // part of the restore. No await between the import and this call.
    window.location.reload();
  } catch (error) {
    console.error('Settings backup import failed:', error);
    toastStore.showToast({
      type: 'error',
      title: t('components.settings.backupRestore.title'),
      message: t('components.settings.backupRestore.importError', { error: error.message }),
      autoClose: false,
    });
    busy.value = false;
  }
}
</script>
