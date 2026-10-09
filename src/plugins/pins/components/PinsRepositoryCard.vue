<template>
  <section class="bg-gray-800 rounded-lg p-4 space-y-3" aria-labelledby="pins-repository-title">
    <h3 id="pins-repository-title" class="text-lg font-semibold text-white">
      {{ $t('plugins.pins.repositoryTitle') }}
    </h3>
    <p class="text-sm text-gray-300">{{ $t('plugins.pins.repositoryDescription') }}</p>
    <p v-if="repository?.channel" class="text-sm text-white" aria-live="polite">
      {{ $t('plugins.pins.repositoryCurrent') }}:
      {{
        repository.channel === 'unstable'
          ? $t('plugins.pins.repositoryUnstable')
          : $t('plugins.pins.repositoryStable')
      }}
    </p>
    <p v-if="repository?.channel === 'unstable'" class="text-sm text-amber-300">
      {{ $t('plugins.pins.repositoryFallback') }}
    </p>
    <p v-if="error" class="text-sm text-red-300" role="alert">{{ error }}</p>
    <div class="flex flex-wrap gap-3">
      <button
        ref="switchButton"
        v-if="repository?.configured"
        class="tns-btn-secondary"
        :disabled="disabled || loading || switching"
        @click="requestSwitch(repository.channel === 'unstable' ? 'trixie' : 'unstable')"
      >
        {{
          switching
            ? $t('plugins.pins.repositorySwitching')
            : repository.channel === 'unstable'
              ? $t('plugins.pins.repositorySwitchStable')
              : $t('plugins.pins.repositorySwitchUnstable')
        }}
      </button>
      <button
        class="tns-btn-secondary"
        :disabled="disabled || loading || switching"
        @click="$emit('refresh')"
      >
        {{ $t('plugins.pins.repositoryRefresh') }}
      </button>
    </div>
    <Modal :show="confirmationStep > 0" maxWidth="max-w-md" @close="cancelConfirmation">
      <template #header>
        <h2 id="pins-unstable-confirm-title" class="text-xl font-bold text-white">
          {{ $t('plugins.pins.repositoryConfirmTitle') }}
        </h2>
      </template>
      <template #body>
        <div
          class="w-full space-y-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pins-unstable-confirm-title"
          aria-describedby="pins-unstable-confirm-message"
          @keydown.esc.stop.prevent="cancelConfirmation"
        >
          <p id="pins-unstable-confirm-message" class="text-amber-300" aria-live="polite">
            {{
              confirmationStep === 1
                ? $t('plugins.pins.repositoryConfirmWarning')
                : $t('plugins.pins.repositoryConfirmLastChance')
            }}
          </p>
          <div class="grid grid-cols-2 gap-3">
            <button
              ref="noButton"
              type="button"
              class="tns-btn-secondary"
              @click="cancelConfirmation"
            >
              {{ $t('general.no') }}
            </button>
            <button type="button" class="tns-btn-danger" @click="confirmUnstable">
              {{ $t('general.yes') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { useUnstableRepositoryConfirmation } from '../composables/useUnstableRepositoryConfirmation';

const props = defineProps({
  repository: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  switching: { type: Boolean, default: false },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['switch', 'refresh']);
const switchButton = ref(null);
const noButton = ref(null);
const { confirmationStep, requestSwitch, confirmUnstable, cancelConfirmation } =
  useUnstableRepositoryConfirmation({
    canSwitch: () =>
      props.repository?.configured && !props.disabled && !props.loading && !props.switching,
    onSwitch: (channel) => emit('switch', channel),
  });

watch(confirmationStep, async (step) => {
  await nextTick();
  if (step > 0) noButton.value?.focus();
  else switchButton.value?.focus();
});

watch(
  () => [props.repository?.channel, props.disabled, props.loading, props.switching],
  cancelConfirmation
);
</script>
