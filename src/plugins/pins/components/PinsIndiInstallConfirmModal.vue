<template>
  <teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 bg-black/60 px-3 py-4 sm:px-6 sm:py-8 flex items-start sm:items-center justify-center"
      @click="onBackdropClick"
    >
      <div
        ref="dialogRef"
        class="w-full max-w-xl rounded-xl border border-gray-700 bg-gray-900 text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pins-indi-install-title"
        tabindex="-1"
        @keydown="onKeydown"
        @click.stop
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3 sm:px-5"
        >
          <h2 id="pins-indi-install-title" class="text-lg sm:text-xl font-semibold">
            {{ t('plugins.pins.indiInstallModalTitle') }}
          </h2>
          <button
            type="button"
            class="rounded p-1 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-50"
            :disabled="installing"
            @click="closeModal"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div class="px-4 py-4 sm:px-5 sm:py-5 space-y-4">
          <div class="rounded-lg border border-gray-700 bg-gray-800/60 p-3 text-sm">
            <p class="text-gray-300">
              <span class="font-semibold text-gray-100"
                >{{ t('plugins.pins.indiInstallModalDriverPackage') }}:</span
              >
              {{ selectedDisplayName || '-' }}
            </p>
            <p class="mt-1 text-gray-300 break-all">
              <span class="font-semibold text-gray-100"
                >{{ t('plugins.pins.indiInstallModalAssetName') }}:</span
              >
              {{ selectedAssetName || '-' }}
            </p>
          </div>

          <div>
            <label
              for="pins-indi-type"
              class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-300"
            >
              {{ t('plugins.pins.indiInstallModalType') }}
            </label>
            <select
              id="pins-indi-type"
              ref="typeFieldRef"
              v-model="form.type"
              class="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-blue-500 disabled:opacity-60"
              :disabled="installing"
            >
              <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
            </select>
            <p v-if="validation.typeError" class="mt-1 text-xs text-red-400">
              {{ validation.typeError }}
            </p>
          </div>

          <div>
            <label
              for="pins-indi-label"
              class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-300"
            >
              {{ t('plugins.pins.indiInstallModalLabel') }}
            </label>
            <input
              id="pins-indi-label"
              ref="labelFieldRef"
              v-model="form.label"
              type="text"
              maxlength="200"
              class="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-blue-500 disabled:opacity-60"
              :disabled="installing"
              autocomplete="off"
            />
            <div class="mt-1 flex items-center justify-between gap-2">
              <p v-if="validation.labelError" class="text-xs text-red-400">
                {{ validation.labelError }}
              </p>
              <span class="ml-auto text-xs text-gray-400">{{ trimmedLabelLength }}/200</span>
            </div>
          </div>

          <p
            v-if="errorMessage"
            class="rounded-md border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-300"
          >
            {{ errorMessage }}
          </p>
        </div>

        <div
          class="border-t border-gray-700 px-4 py-3 sm:px-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2"
        >
          <button
            type="button"
            class="default-button-gray w-full sm:w-auto"
            :disabled="installing"
            @click="closeModal"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            class="default-button-cyan w-full sm:w-auto disabled:opacity-50"
            :disabled="installing || !validation.isValid"
            @click="submit"
          >
            <span v-if="installing">{{ t('plugins.pins.indiInstallModalInstalling') }}</span>
            <span v-else>{{ t('plugins.pins.indiInstallModalInstall') }}</span>
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ALLOWED_INDI_DRIVER_TYPES,
  getIndiInstallDisplayName,
  inferIndiDriverType,
  normalizeIndiLabel,
  validateIndiInstallForm,
} from '../composables/indiInstallUtils';

const { t } = useI18n();

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  selectedItem: {
    type: Object,
    default: null,
  },
  installing: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['close', 'confirm']);

const dialogRef = ref(null);
const typeFieldRef = ref(null);
const labelFieldRef = ref(null);

const form = ref({
  type: 'switches',
  label: '',
});

const typeOptions = ALLOWED_INDI_DRIVER_TYPES;

const selectedDisplayName = computed(() => getIndiInstallDisplayName(props.selectedItem));
const selectedAssetName = computed(() => props.selectedItem?.assetName || '');

const validation = computed(() => validateIndiInstallForm(form.value));
const trimmedLabelLength = computed(() => normalizeIndiLabel(form.value.label).length);

function initializeFormFromSelection() {
  form.value.type = inferIndiDriverType(props.selectedItem);
  form.value.label = selectedDisplayName.value || '';
}

function closeModal() {
  if (!props.installing) {
    emit('close');
  }
}

function submit() {
  if (props.installing || !validation.value.isValid) {
    return;
  }

  emit('confirm', {
    type: validation.value.normalizedType,
    label: validation.value.normalizedLabel,
  });
}

function getFocusableElements() {
  if (!dialogRef.value) {
    return [];
  }

  const elements = dialogRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  return Array.from(elements).filter((el) => !el.hasAttribute('disabled'));
}

function trapFocus(event) {
  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableElements();
  if (!focusableElements.length) {
    event.preventDefault();
    return;
  }

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event) {
  trapFocus(event);

  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key === 'Enter' && !props.installing && validation.value.isValid) {
    event.preventDefault();
    submit();
  }
}

function onBackdropClick() {
  closeModal();
}

watch(
  () => props.show,
  async (isVisible) => {
    if (!isVisible) {
      document.body.style.overflow = '';
      return;
    }

    initializeFormFromSelection();
    document.body.style.overflow = 'hidden';

    await nextTick();
    if (typeFieldRef.value) {
      typeFieldRef.value.focus();
    } else if (labelFieldRef.value) {
      labelFieldRef.value.focus();
    } else if (dialogRef.value) {
      dialogRef.value.focus();
    }
  }
);

watch(
  () => props.selectedItem,
  () => {
    if (props.show && !props.installing) {
      initializeFormFromSelection();
    }
  }
);

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>
