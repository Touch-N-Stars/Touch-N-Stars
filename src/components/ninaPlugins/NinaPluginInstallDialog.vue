<template>
  <Modal
    :show="installStore.show"
    :disableClose="installStore.isBusy"
    :closeOnBackdropClick="!installStore.isBusy"
    maxWidth="max-w-lg"
    zIndex="z-top"
    @close="installStore.close()"
  >
    <template #header>
      <h2 class="text-xl font-bold text-white">{{ $t('components.ninaPluginInstall.title') }}</h2>
    </template>

    <template #body>
      <div class="w-full flex flex-col gap-4 text-sm text-content">
        <template v-if="phase === 'confirm'">
          <p>
            {{ $t('components.ninaPluginInstall.confirm', { plugin: pluginName, name: ninaName }) }}
          </p>
          <p class="text-status-warn">
            {{ $t('components.ninaPluginInstall.confirmRestartHint') }}
            {{ $t('components.ninaPluginInstall.restartHint') }}
          </p>
          <div class="flex justify-end gap-3">
            <button class="tns-btn-secondary w-auto!" @click="installStore.close()">
              {{ $t('common.cancel') }}
            </button>
            <button class="tns-btn-primary w-auto!" @click="installStore.install()">
              {{ $t('components.ninaPluginInstall.install') }}
            </button>
          </div>
        </template>

        <template v-else-if="phase === 'installing'">
          <p class="flex items-center gap-2">
            <span
              class="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden="true"
            ></span>
            {{ $t('components.ninaPluginInstall.installing', { package: packageName }) }}
          </p>
        </template>

        <template v-else-if="phase === 'failed'">
          <p class="text-status-danger">
            {{ $t('components.ninaPluginInstall.failed', { message: installStore.errorMessage }) }}
          </p>
          <div class="flex justify-end gap-3">
            <button class="tns-btn-secondary w-auto!" @click="installStore.close()">
              {{ $t('common.close') }}
            </button>
            <button class="tns-btn-primary w-auto!" @click="installStore.install()">
              {{ $t('components.ninaPluginInstall.retry') }}
            </button>
          </div>
        </template>

        <template v-else-if="phase === 'restartPrompt'">
          <p>{{ $t('components.ninaPluginInstall.installed', { name: ninaName }) }}</p>
          <p class="text-content-muted">{{ $t('components.ninaPluginInstall.restartHint') }}</p>
          <div
            v-if="sequenceStore.sequenceRunning"
            class="flex flex-col gap-2 rounded-lg border border-status-warn/60 bg-status-warn/15 p-3"
          >
            <p class="text-status-warn font-medium">
              {{ $t('components.ninaPluginInstall.sequenceWarning') }}
            </p>
            <label class="flex items-center gap-2 min-h-touch">
              <input v-model="sequenceAbortConfirmed" type="checkbox" class="h-5 w-5" />
              {{ $t('components.ninaPluginInstall.sequenceConfirm') }}
            </label>
          </div>
          <p v-if="installStore.errorMessage" class="text-status-danger">
            {{
              $t('components.ninaPluginInstall.restartFailed', {
                message: installStore.errorMessage,
              })
            }}
          </p>
          <div class="flex justify-end gap-3">
            <button class="tns-btn-secondary w-auto!" @click="installStore.close()">
              {{ $t('components.ninaPluginInstall.later') }}
            </button>
            <button
              class="tns-btn-primary w-auto!"
              :disabled="!canRestart"
              @click="installStore.restartPins()"
            >
              {{ $t('components.ninaPluginInstall.restart') }}
            </button>
          </div>
        </template>

        <template v-else-if="phase === 'restarting'">
          <p class="flex items-center gap-2">
            <span
              class="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden="true"
            ></span>
            {{ $t('components.ninaPluginInstall.restarting', { name: ninaName }) }}
          </p>
        </template>

        <template v-else-if="phase === 'restartTimeout'">
          <p>{{ $t('components.ninaPluginInstall.restartTimeout', { name: ninaName }) }}</p>
          <div class="flex justify-end">
            <button class="tns-btn-secondary w-auto!" @click="installStore.close()">
              {{ $t('common.close') }}
            </button>
          </div>
        </template>

        <template v-else-if="phase === 'done'">
          <p class="text-status-ok">
            {{ $t('components.ninaPluginInstall.done', { name: ninaName }) }}
          </p>
          <div class="flex justify-end">
            <button class="tns-btn-primary w-auto!" @click="installStore.close()">
              {{ $t('common.close') }}
            </button>
          </div>
        </template>

        <pre
          v-if="installStore.logLines.length && (phase === 'installing' || phase === 'failed')"
          ref="logEl"
          class="select-text max-h-48 overflow-auto rounded bg-black p-2 font-mono text-xs text-content whitespace-pre-wrap"
          >{{ installStore.logLines.join('\n') }}</pre>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { useNinaPluginInstallStore } from '@/store/ninaPluginInstallStore';
import { useSequenceStore } from '@/store/sequenceStore';

const installStore = useNinaPluginInstallStore();
const sequenceStore = useSequenceStore();

const sequenceAbortConfirmed = ref(false);
const logEl = ref(null);

const phase = computed(() => installStore.phase);
const pluginName = computed(() => installStore.pluginName);
const ninaName = computed(() => installStore.requirement?.displayName || '');
const packageName = computed(() => installStore.requirement?.pinsPackage || '');

// A running sequence would be aborted by the restart: that needs its own confirmation.
const canRestart = computed(() => !sequenceStore.sequenceRunning || sequenceAbortConfirmed.value);

watch(phase, () => {
  sequenceAbortConfirmed.value = false;
});

watch(
  () => installStore.logLines.length,
  async () => {
    await nextTick();
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
  }
);
</script>
