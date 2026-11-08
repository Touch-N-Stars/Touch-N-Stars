<template>
  <div class="flex flex-col space-y-6">
    <PinsRepositoryCard
      :repository="repository"
      :loading="repositoryLoading"
      :switching="repositorySwitching"
      :error="repositoryError"
      :disabled="isBusy"
      @switch="switchRepository"
      @refresh="loadRepository"
    />
    <PinsPluginsCard
      :plugins="ninaPackages"
      :loading="isNinaPackagesLoading"
      :checked-at="ninaPackagesCheckedAt"
      :busy-package="busyPackage"
      :disabled="isBusy"
      @refresh="loadNinaPackages"
      @install="requestPackageAction('install', $event)"
      @uninstall="requestPackageAction('uninstall', $event)"
    />

    <Modal :show="Boolean(pendingAction)" maxWidth="max-w-md" @close="pendingAction = null">
      <template #header>
        <h2 class="text-xl font-bold text-content">
          {{
            pendingAction?.action === 'uninstall'
              ? $t('plugins.pins.pluginsUninstall')
              : $t('plugins.pins.pluginsInstall')
          }}
        </h2>
      </template>

      <template #body>
        <div class="w-full flex flex-col gap-4 text-sm text-content">
          <p class="font-medium break-all">{{ pendingAction?.packageName }}</p>
          <p class="text-status-warn">
            {{
              pendingAction?.action === 'uninstall'
                ? $t('plugins.pins.uninstallRestartWarning')
                : $t('plugins.pins.installRestartWarning')
            }}
          </p>
          <div
            v-if="pendingAction?.action === 'uninstall' && sequenceStore.sequenceRunning"
            class="flex flex-col gap-2 rounded-control border border-status-warn/40 bg-status-warn/10 p-3"
          >
            <p class="text-status-warn font-medium">
              {{ $t('components.ninaPluginInstall.sequenceWarning') }}
            </p>
            <label class="flex items-center gap-2 min-h-touch">
              <input
                v-model="sequenceAbortConfirmed"
                type="checkbox"
                class="h-5 w-5 accent-accent-action"
              />
              {{ $t('plugins.pins.uninstallSequenceConfirm') }}
            </label>
          </div>
          <div class="flex justify-end gap-3">
            <button class="tns-btn-secondary w-auto!" @click="pendingAction = null">
              {{ $t('common.cancel') }}
            </button>
            <button
              :class="
                pendingAction?.action === 'uninstall'
                  ? 'tns-btn-danger w-auto!'
                  : 'tns-btn-primary w-auto!'
              "
              :disabled="!canConfirmPackageAction"
              @click="confirmPackageAction"
            >
              {{
                pendingAction?.action === 'uninstall'
                  ? $t('plugins.pins.pluginsUninstall')
                  : $t('plugins.pins.pluginsInstall')
              }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useSequenceStore } from '@/store/sequenceStore';
import Modal from '@/components/helpers/Modal.vue';
import PinsPluginsCard from '../PinsPluginsCard.vue';
import PinsRepositoryCard from '../PinsRepositoryCard.vue';
import { usePinsJobRunner } from '../composables/usePinsJobRunner';
import { usePinsRepository } from '../composables/usePinsRepository';
import { usePinsPackages } from '../composables/usePinsPackages';
import { usePinsUpdates } from '../composables/usePinsUpdates';

const { t } = useI18n();
const store = apiStore();
const runner = usePinsJobRunner({ t });
const { isBusy } = runner;
const sequenceStore = useSequenceStore();

// Package changes touch NINA: an uninstall restarts it right away (manage-plugin.sh), an
// install only takes effect after the next NINA restart. Both are confirmed first.
const pendingAction = ref(null);
const sequenceAbortConfirmed = ref(false);

const canConfirmPackageAction = computed(
  () =>
    pendingAction.value?.action !== 'uninstall' ||
    !sequenceStore.sequenceRunning ||
    sequenceAbortConfirmed.value
);

function requestPackageAction(action, packageName) {
  sequenceAbortConfirmed.value = false;
  pendingAction.value = { action, packageName };
}

function confirmPackageAction() {
  const { action, packageName } = pendingAction.value;
  pendingAction.value = null;
  if (action === 'uninstall') uninstallPackage(packageName);
  else installPackage(packageName);
}

const {
  ninaPackages,
  isNinaPackagesLoading,
  ninaPackagesCheckedAt,
  busyPackage,
  loadNinaPackages,
  installPackage,
  uninstallPackage,
} = usePinsPackages({ t, runner });
// A repository switch changes which updates are pending; the Upgrade tab shows them.
const { checkUpdates } = usePinsUpdates({ t, runner });

const {
  repository,
  repositoryLoading,
  repositorySwitching,
  repositoryError,
  loadRepository,
  switchRepository,
} = usePinsRepository({
  t,
  status: runner.status,
  pinsStore: runner.pinsStore,
  appendLog: runner.appendLog,
  refreshPackages: () => Promise.all([checkUpdates(), loadNinaPackages()]),
});

watch(
  () => store.isPINS,
  (isPins) => {
    if (isPins) loadRepository();
  },
  { immediate: true }
);
</script>
