<template>
  <!-- Deliberately transparent: the app underneath stays fully readable and
       keeps updating, only the touches are swallowed. The overlay itself is the
       blocker - every tap lands here instead of on a control, which also covers
       drag & drop, pinch zoom and scroll (touch-action: none). No backdrop-filter:
       it would create a containing block for position: fixed children. -->
  <div
    class="screen-lock-overlay fixed inset-0 z-lock select-none"
    @pointerdown="showBlockedHint"
    @contextmenu.prevent
    @wheel.prevent
  >
    <div class="unlock-anchor" :class="isLandscape ? 'unlock-anchor-landscape' : ''">
      <Transition name="hint">
        <p
          v-if="showHint"
          class="mb-2 px-3 py-1.5 rounded-chip bg-surface-1/90 border border-line text-xs text-content text-center shadow-lg"
        >
          {{ t('plugins.screenLock.holdToUnlock', { seconds: UNLOCK_HOLD_SECONDS }) }}
        </p>
      </Transition>

      <button
        ref="unlockButtonRef"
        type="button"
        class="unlock-button min-h-touch min-w-touch relative flex items-center justify-center rounded-full border border-line-strong bg-surface-1/90 text-content shadow-lg"
        :class="{ 'unlock-button-holding': isHolding }"
        data-haptic="none"
        :aria-label="t('plugins.screenLock.unlock')"
        @pointerdown.stop="startPointerHold"
        @keydown.enter.prevent="startKeyHold"
        @keydown.space.prevent="startKeyHold"
        @keyup.enter.prevent="endHold"
        @keyup.space.prevent="endHold"
        @blur="endHold"
        @contextmenu.prevent
      >
        <!-- Progress ring, same stroke-dasharray technique as the exposure ring
             in NavigationComp.vue -->
        <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
          <path
            class="fill-none stroke-line-strong stroke-[2.5]"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            class="fill-none stroke-accent stroke-[2.5]"
            stroke-linecap="round"
            :style="{ strokeDasharray: `${Math.round(progress * 100)}, 100` }"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <LockClosedIcon
          class="transition-[width,height] duration-150"
          :class="[
            isHolding ? 'w-12 h-12' : 'w-6 h-6',
            progress > 0 ? 'text-accent' : 'text-content',
          ]"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LockClosedIcon } from '@heroicons/vue/24/outline';
import { useSettingsStore } from '@/store/settingsStore';
import { useOrientation } from '@/composables/useOrientation';
import { useHaptics } from '@/composables/useHaptics';
import { createHoldTimer } from '@/utils/holdTimer';

const UNLOCK_HOLD_SECONDS = 2;
const HINT_VISIBLE_MS = 2000;

const { t } = useI18n();
const settingsStore = useSettingsStore();
const { isLandscape } = useOrientation();
const { tapLight, notifySuccess } = useHaptics();

const progress = ref(0);
const showHint = ref(false);
const unlockButtonRef = ref(null);
let hintTimeoutId = null;
let backButtonListenerHandle = null;
let heldPointerId = null;
// Reactive: the template grows the button while a hold is running so the
// progress ring is readable under the finger.
const isHolding = ref(false);

const holdTimer = createHoldTimer({
  durationMs: UNLOCK_HOLD_SECONDS * 1000,
  onProgress: (value) => {
    progress.value = value;
  },
  onComplete: () => {
    progress.value = 0;
    endHold();
    void notifySuccess();
    settingsStore.unlockScreen();
  },
});

// Pointer capture is what makes the hold survive normal finger drift across a
// 48 px target: without it the first pointerleave cancels the only way out of
// the lock. Same pattern the landscaper-creator view uses for its drag handling.
function startPointerHold(event) {
  if (heldPointerId !== null) return;
  heldPointerId = event.pointerId ?? null;
  unlockButtonRef.value?.setPointerCapture?.(event.pointerId);
  // Fallback for the (older browser) case where capture is unavailable: the
  // release then happens outside the button and would never reach it, leaving a
  // hold running with no finger on the screen.
  window.addEventListener('pointerup', handlePointerEnd);
  window.addEventListener('pointercancel', handlePointerEnd);
  beginHold();
}

function handlePointerEnd(event) {
  if (heldPointerId !== null && event.pointerId !== heldPointerId) return;
  endHold();
}

// Keyboard path for the browser target: key events are blocked everywhere else
// while locked (see handleKeyEvent), so this button has to stay operable or a
// keyboard-only desktop would have no way out at all. Enter/Space auto-repeat
// while held down, hence the isHolding guard.
function startKeyHold() {
  if (isHolding.value) return;
  beginHold();
}

function beginHold() {
  isHolding.value = true;
  void tapLight();
  hideHint();
  holdTimer.start();
}

function endHold() {
  if (!isHolding.value) return;
  isHolding.value = false;
  if (heldPointerId !== null) {
    unlockButtonRef.value?.releasePointerCapture?.(heldPointerId);
    heldPointerId = null;
  }
  window.removeEventListener('pointerup', handlePointerEnd);
  window.removeEventListener('pointercancel', handlePointerEnd);
  holdTimer.cancel();
}

function hideHint() {
  if (hintTimeoutId) {
    clearTimeout(hintTimeoutId);
    hintTimeoutId = null;
  }
  showHint.value = false;
}

// A tap anywhere else is swallowed on purpose. Without feedback a transparent
// overlay reads as a frozen app, so point at the way out instead.
function showBlockedHint() {
  showHint.value = true;
  if (hintTimeoutId) clearTimeout(hintTimeoutId);
  hintTimeoutId = setTimeout(() => {
    showHint.value = false;
    hintTimeoutId = null;
  }, HINT_VISIBLE_MS);
}

// The overlay swallows pointer input, but on the browser target a physical
// keyboard could otherwise still tab and Enter its way through the controls
// underneath. Everything outside the unlock button is dropped in the capture
// phase, which also pins focus in place (Tab never reaches another control).
function handleKeyEvent(event) {
  if (unlockButtonRef.value?.contains(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  showBlockedHint();
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyEvent, true);
  window.addEventListener('keyup', handleKeyEvent, true);
  window.addEventListener('keypress', handleKeyEvent, true);
  // Give the unlock button the focus so the keyboard path above has a target.
  await nextTick();
  unlockButtonRef.value?.focus?.({ preventScroll: true });

  // Registering any backButton listener suppresses Capacitor's default (history
  // back, or exiting the app on the first route). This one does nothing on
  // purpose: while locked, the hardware back button must neither navigate nor
  // release the lock.
  if (Capacitor.getPlatform() === 'android') {
    backButtonListenerHandle = await CapacitorApp.addListener('backButton', () => {});
  }
});

onBeforeUnmount(async () => {
  endHold();
  holdTimer.dispose();
  hideHint();
  window.removeEventListener('keydown', handleKeyEvent, true);
  window.removeEventListener('keyup', handleKeyEvent, true);
  window.removeEventListener('keypress', handleKeyEvent, true);
  await backButtonListenerHandle?.remove();
  backButtonListenerHandle = null;
});
</script>

<style scoped>
.screen-lock-overlay {
  /* Swallows scroll, pinch zoom and drag gestures rather than passing them on. */
  touch-action: none;
  overscroll-behavior: contain;
  -webkit-touch-callout: none;
}

/* Floats just above the status bar (incl. safe area and any open status panel),
   centered on the stage. */
.unlock-anchor {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--above-statusbar) + var(--status-panel-height));
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 1rem;
}

.unlock-anchor-landscape {
  left: var(--nav-width);
}

.unlock-button {
  width: var(--spacing-touch);
  height: var(--spacing-touch);
  touch-action: none;
  -webkit-touch-callout: none;
  transition:
    width 0.15s ease,
    height 0.15s ease;
}

/* Grows to twice the touch target while held: the finger covers most of a
   48 px button, so the progress ring is only readable at the larger size. The
   anchor is bottom-aligned, so the growth goes upward, away from the status bar. */
.unlock-button-holding {
  width: calc(var(--spacing-touch) * 3);
  height: calc(var(--spacing-touch) * 3);
}

.hint-enter-active,
.hint-leave-active {
  transition: opacity 0.2s ease;
}

.hint-enter-from,
.hint-leave-to {
  opacity: 0;
}
</style>
