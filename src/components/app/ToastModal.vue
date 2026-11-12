<template>
  <!-- Confirmation/Critical Toasts (blocking) -->
  <Modal
    :show="toastStore.newMessage && (toastStore.isConfirmation || toastStore.type === 'critical')"
    :disableClose="true"
    :closeOnBackdropClick="false"
    zIndex="z-toast"
    maxWidth="max-w-xl"
  >
    <template #header>
      <h2 class="text-xl font-bold text-content">{{ toastStore.title }}</h2>
    </template>
    <template #body>
      <div class="w-full space-y-4">
        <p class="text-content text-center">{{ toastStore.message }}</p>

        <!-- Link-Bereich -->
        <div class="flex items-center gap-2" v-if="toastStore.link && toastStore.linkText">
          <GlobeAltIcon class="w-6 h-6" />
          <a :href="toastStore.link" target="_blank" class="text-accent hover:underline">
            {{ toastStore.linkText }}
          </a>
        </div>

        <!-- Bestätigungsbuttons -->
        <div v-if="toastStore.isConfirmation" class="flex gap-4 mt-6">
          <button class="tns-btn-secondary" @click="toastStore.cancelAction()">
            {{ toastStore.cancelText }}
          </button>
          <button class="tns-btn-primary" @click="toastStore.confirmAction()">
            {{ toastStore.confirmText }}
          </button>
        </div>
      </div>
    </template>
  </Modal>

  <!-- Non-blocking Toast Notifications -->
  <div class="fixed top-4 right-4 z-toast space-y-3 max-w-sm pointer-events-none">
    <transition-group name="toast-slide">
      <div
        v-if="toastStore.newMessage && !toastStore.isConfirmation && toastStore.type !== 'critical'"
        key="toast"
        :class="[
          'bg-surface-2 text-content p-4 rounded-lg shadow-lg pointer-events-auto',
          toastTypeShadow,
          toastTypeClasses,
        ]"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="font-bold text-sm mb-1">{{ toastStore.title }}</h3>
            <p class="text-sm text-content">{{ toastStore.message }}</p>

            <!-- Link für Toast -->
            <div class="flex items-center gap-2 mt-2" v-if="toastStore.link && toastStore.linkText">
              <GlobeAltIcon class="w-4 h-4" />
              <a
                :href="toastStore.link"
                target="_blank"
                class="text-accent hover:underline text-sm"
              >
                {{ toastStore.linkText }}
              </a>
            </div>

            <!-- Optional action (e.g. "Replay") -->
            <button
              v-if="toastStore.actionText && toastStore.onAction"
              type="button"
              class="tns-btn-secondary w-auto! px-3! mt-2 text-xs!"
              @click="toastStore.runToastAction()"
            >
              {{ toastStore.actionText }}
            </button>
          </div>
          <button
            @click="toastStore.closeToast()"
            class="text-content-muted hover:text-content ml-2 shrink-0"
          >
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue';
import { useToastStore } from '@/store/toastStore';
import { XMarkIcon, GlobeAltIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';

const toastStore = useToastStore();

// Auto-close Timer
let autoCloseTimer = null;

// Watch für neue Toast-Nachrichten
// toastSeq changes for every toast, also one replacing a toast that is still open: the old timer
// must not close the new toast, and a new auto-close toast needs its own timer.
watch(
  () => [toastStore.newMessage, toastStore.toastSeq],
  ([newValue]) => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    if (
      newValue &&
      !toastStore.isConfirmation &&
      toastStore.type !== 'critical' &&
      toastStore.autoClose
    ) {
      // Timer für normale Toast-Nachrichten (nicht für Confirmations oder Critical)
      autoCloseTimer = setTimeout(() => {
        toastStore.closeToast();
      }, toastStore.autoCloseDelay);
    }
  },
  { immediate: true }
);

// Cleanup bei Component-Destroy
onBeforeUnmount(() => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
  }
});

const toastTypeShadow = computed(() => {
  switch (toastStore.type) {
    case 'info':
      return 'shadow-lg shadow-accent/50 ring-1 ring-accent/50';
    case 'success':
      return 'shadow-lg shadow-status-ok/50 ring-1 ring-status-ok/50';
    case 'warning':
      return 'shadow-lg shadow-status-warn/50 ring-1 ring-status-warn/50';
    case 'error':
      return 'shadow-lg shadow-status-danger/50 ring-1 ring-status-danger/50';
    default:
      return '';
  }
});

const toastTypeClasses = computed(() => {
  switch (toastStore.type) {
    case 'info':
      return 'border-l-4 border-accent';
    case 'success':
      return 'border-l-4 border-status-ok';
    case 'warning':
      return 'border-l-4 border-status-warn';
    case 'error':
      return 'border-l-4 border-status-danger';
    default:
      return 'border-l-4 border-accent-action';
  }
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-slide-enter-active {
  transition: all 0.3s ease-out;
}
.toast-slide-leave-active {
  transition: all 0.3s ease-in;
}
.toast-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.toast-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
