<template>
  <div
    ref="overlayElement"
    class="fixed inset-0 z-modal-raised flex items-center justify-center bg-black/60 backdrop-blur-sm"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-available-title"
      class="relative mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-accent/40 bg-surface-1 shadow-2xl"
    >
      <div class="p-6 sm:p-8">
        <div class="mb-6 flex items-start gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="m5 13 4 4L19 7"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h2 id="update-available-title" class="text-2xl font-semibold text-white">
              {{ titleText }}
            </h2>
            <p class="mt-2 text-sm text-content">
              {{ descriptionText }}
            </p>
          </div>
        </div>

        <div
          v-if="hasWhatsNew"
          class="mb-6 max-h-52 overflow-y-auto rounded-xl border border-line bg-surface-2 p-4 text-sm text-content"
        >
          <p class="mb-2 font-semibold text-content">{{ t('updates.whatsNew') }}</p>
          <p
            v-if="whatsNewTitle"
            class="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted"
          >
            {{ whatsNewTitle }}
          </p>
          <div
            v-if="whatsNewHtml"
            class="space-y-2 text-sm leading-relaxed text-content"
            v-html="whatsNewHtml"
          ></div>
          <pre
            v-else-if="whatsNewText"
            class="whitespace-pre-wrap font-sans leading-relaxed text-content"
            v-text="whatsNewText"
          ></pre>
        </div>

        <div
          v-if="releaseNotes && !upToDate"
          class="mb-6 max-h-52 overflow-y-auto rounded-xl border border-line bg-surface-2 p-4 text-sm text-content"
        >
          <p class="mb-2 font-semibold text-content">{{ t('updates.releaseNotes') }}</p>
          <pre
            class="whitespace-pre-wrap font-sans leading-relaxed text-content"
            v-text="releaseNotes"
          ></pre>
        </div>

        <div v-if="status === 'downloading'" class="mb-6">
          <p class="mb-2 text-sm text-content">
            {{ t('updates.downloading', { progress: formattedProgress }) }}
          </p>
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full rounded-full bg-accent transition-all duration-200"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>

        <div v-if="status === 'setting'" class="mb-4 text-sm text-content">
          {{ t('updates.preparing') }}
        </div>

        <p v-if="error" class="mb-4 rounded-lg bg-status-danger/10 p-3 text-sm text-status-danger">
          {{ error }}
        </p>

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <!-- Up to date: closing is the expected action, reinstalling is the fallback -->
          <button
            type="button"
            :class="upToDate ? primaryButtonClass : secondaryButtonClass"
            :disabled="isBusy"
            @click="$emit('cancel')"
          >
            {{ upToDate ? t('common.close') : t('updates.later') }}
          </button>
          <button
            type="button"
            :class="upToDate ? secondaryButtonClass : primaryButtonClass"
            :disabled="isBusy"
            @click="$emit('confirm')"
          >
            <span v-if="isBusy">{{ t('updates.working') }}</span>
            <span v-else>{{ confirmText }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="absolute right-4 top-4 rounded-full bg-surface-2/80 p-2 text-content-muted transition hover:text-white"
        :disabled="isBusy"
        @click="$emit('cancel')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useModalEscape } from '@/composables/useModalEscape';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  version: {
    type: String,
    required: true,
  },
  whatsNew: {
    type: [Object, String],
    default: null,
  },
  releaseNotes: {
    type: String,
    default: '',
  },
  progress: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    default: 'idle',
  },
  error: {
    type: String,
    default: '',
  },
  isDowngrade: {
    type: Boolean,
    default: false,
  },
  // Manual check found nothing newer: the offered release is the installed version or,
  // with isDowngrade, older than it (e.g. a beta installed while the stable channel is selected).
  upToDate: {
    type: Boolean,
    default: false,
  },
  currentVersion: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['confirm', 'cancel']);

const overlayElement = ref(null);
useModalEscape(overlayElement, () => emit('cancel'));

const busyStatuses = new Set(['downloading', 'setting']);

const isBusy = computed(() => busyStatuses.has(props.status));
const formattedProgress = computed(() => Math.round(props.progress));
const whatsNewTitle = computed(() =>
  typeof props.whatsNew === 'object' && props.whatsNew
    ? props.whatsNew.title || props.whatsNew.version || ''
    : ''
);
const whatsNewHtml = computed(() =>
  typeof props.whatsNew === 'object' && props.whatsNew ? props.whatsNew.html || '' : ''
);
const whatsNewText = computed(() => {
  if (!props.whatsNew) {
    return '';
  }
  if (typeof props.whatsNew === 'string') {
    return props.whatsNew;
  }
  if (props.whatsNew.markdown) {
    return props.whatsNew.markdown;
  }
  if (!props.whatsNew.html) {
    return JSON.stringify(props.whatsNew, null, 2);
  }
  return '';
});
const hasWhatsNew = computed(() =>
  Boolean(whatsNewHtml.value || whatsNewText.value || whatsNewTitle.value)
);

const { t } = useI18n();

const primaryButtonClass =
  'rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ground transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-accent disabled:text-content';
const secondaryButtonClass =
  'rounded-xl border border-line px-4 py-2 text-sm font-medium text-content transition hover:border-line-strong hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-content-faint';

const titleText = computed(() => {
  if (props.upToDate) return t('updates.upToDateTitle');
  return props.isDowngrade ? t('updates.downgradeTitle') : t('updates.title');
});
const descriptionText = computed(() => {
  if (props.upToDate) {
    return props.isDowngrade
      ? t('updates.upToDateNewer', { current: props.currentVersion, version: props.version })
      : t('updates.upToDateVersion', { version: props.version });
  }
  return props.isDowngrade
    ? t('updates.downgradeDescription', { version: props.version })
    : t('updates.description', { version: props.version });
});
const confirmText = computed(() => {
  if (!props.upToDate) return t('updates.updateNow');
  return props.isDowngrade
    ? t('updates.installVersion', { version: props.version })
    : t('updates.installAnyway');
});
</script>
