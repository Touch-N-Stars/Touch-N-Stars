<template>
  <teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/60 px-3 py-4 sm:px-6 sm:py-8 flex items-start sm:items-center justify-center"
      :class="zIndex"
      @click="onBackdropClick"
    >
      <div
        ref="dialogRef"
        class="w-full max-w-xl rounded-card border border-line bg-surface-1 text-content shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pins-indi-install-title"
        tabindex="-1"
        @keydown="onKeydown"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id="pins-indi-install-title" class="text-lg sm:text-xl font-semibold">
            {{ t('plugins.pins.indiInstallModalTitle') }}
          </h2>
          <button
            type="button"
            class="min-h-touch min-w-touch flex items-center justify-center rounded-control text-content-muted hover:text-content hover:bg-surface-2 disabled:opacity-50"
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
          <div class="rounded-control border border-line bg-surface-2 p-3 text-sm">
            <p class="text-content-muted">
              <span class="font-semibold text-content"
                >{{ t('plugins.pins.indiInstallModalDriverPackage') }}:</span
              >
              {{ selectedDisplayName || '-' }}
            </p>
            <p class="mt-1 text-content-muted break-all">
              <span class="font-semibold text-content"
                >{{ t('plugins.pins.indiInstallModalAssetName') }}:</span
              >
              {{ selectedAssetName || '-' }}
            </p>
          </div>

          <div>
            <label for="pins-indi-type" class="tns-label mb-1 block">
              {{ t('plugins.pins.indiInstallModalType') }}
            </label>
            <select
              id="pins-indi-type"
              ref="typeFieldRef"
              v-model="form.type"
              class="tns-select"
              :disabled="installing"
            >
              <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
            </select>
            <p v-if="validation.typeError" class="mt-1 text-xs text-status-danger">
              {{ validation.typeError }}
            </p>
          </div>

          <div>
            <label for="pins-indi-label" class="tns-label mb-1 block">
              {{ t('plugins.pins.indiInstallModalLabel') }}
            </label>
            <input
              id="pins-indi-label"
              ref="labelFieldRef"
              v-model="form.label"
              type="text"
              maxlength="200"
              class="tns-input"
              :disabled="installing"
              autocomplete="off"
            />
            <div class="mt-1 flex items-center justify-between gap-2">
              <p v-if="validation.labelError" class="text-xs text-status-danger">
                {{ validation.labelError }}
              </p>
              <span class="ml-auto text-xs text-content-muted">{{ trimmedLabelLength }}/200</span>
            </div>
          </div>

          <p
            v-if="errorMessage"
            class="rounded-control border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
          >
            {{ errorMessage }}
          </p>
        </div>

        <div class="border-t border-line px-4 py-3 sm:px-5">
          <div class="grid grid-cols-2 gap-3 w-full sm:min-w-[18rem]">
            <button
              type="button"
              class="tns-btn-secondary"
              :disabled="installing"
              @click="closeModal"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="tns-btn-primary"
              :disabled="installing || !validation.isValid"
              @click="submit"
            >
              <span v-if="installing">{{ t('plugins.pins.indiInstallModalInstalling') }}</span>
              <span v-else>{{ t('plugins.pins.indiInstallModalInstall') }}</span>
            </button>
          </div>
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
} from './composables/indiInstallUtils';

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
  // Callers rendering this from inside a full-screen overlay (the PINS setup
  // wizard sits at z-overlay) must raise this, or the dialog opens behind them.
  zIndex: {
    type: String,
    default: 'z-modal-raised',
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

  emit('close');

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
