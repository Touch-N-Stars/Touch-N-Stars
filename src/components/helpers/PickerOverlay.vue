<template>
  <Transition name="fade">
    <div
      v-if="pickerStore.isOpen"
      class="fixed inset-0 z-numberPad flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm"
      @click="pickerStore.cancel()"
    >
      <!-- Bottom sheet -->
      <div
        class="bg-surface-1/95 backdrop-blur-sm border-t border-line w-full p-4 rounded-t-lg"
        @click.stop
      >
        <div class="max-w-sm mx-auto">
          <!-- Header: Cancel / Value / Confirm -->
          <div class="flex items-center justify-between mb-3">
            <button
              @click="pickerStore.cancel()"
              class="p-2 rounded-full transition-colors text-status-danger hover:bg-surface-3"
            >
              <XMarkIcon class="h-6 w-6" />
            </button>
            <div class="flex flex-col items-center">
              <label class="tns-label">{{ $t(`${pickerStore.label}`) }}</label>
              <span
                :class="[
                  'text-2xl font-bold tabular-nums',
                  pickerStore.isOutOfRange ? 'text-status-danger' : 'text-content',
                ]"
              >
                {{ pickerStore.displayValue }}
              </span>
            </div>
            <button
              @click="pickerStore.close()"
              :disabled="isConfirmDisabled"
              :class="[
                'p-2 rounded-full transition-colors',
                isConfirmDisabled
                  ? 'text-content-faint cursor-not-allowed'
                  : 'text-status-ok hover:bg-surface-3',
              ]"
            >
              <CheckIcon class="h-6 w-6" />
            </button>
          </div>
          <!-- Numpad grid -->
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="n in [1, 2, 3]"
              :key="n"
              @click="pickerStore.appendDigit(n)"
              class="numpad-btn"
            >
              {{ n }}
            </button>
            <button @click="pickerStore.backspace()" class="numpad-btn numpad-action">
              <BackspaceIcon class="h-6 w-6 mx-auto" />
            </button>

            <button
              v-for="n in [4, 5, 6]"
              :key="n"
              @click="pickerStore.appendDigit(n)"
              class="numpad-btn"
            >
              {{ n }}
            </button>
            <button @click="pickerStore.clearInput()" class="numpad-btn numpad-action">C</button>

            <button
              v-for="n in [7, 8, 9]"
              :key="n"
              @click="pickerStore.appendDigit(n)"
              class="numpad-btn"
            >
              {{ n }}
            </button>
            <button
              @click="pickerStore.appendDecimal()"
              :disabled="pickerStore.hasDecimalPoint || pickerStore.decimalPlaces === 0"
              class="numpad-btn"
            >
              .
            </button>

            <!-- Bottom row -->
            <button
              @click="pickerStore.setNegative()"
              :disabled="!pickerStore.isNegativeAllowed"
              :class="[
                'numpad-btn numpad-action',
                pickerStore.inputString.startsWith('-') ? 'numpad-active' : '',
              ]"
            >
              −
            </button>
            <button @click="pickerStore.appendDigit(0)" class="numpad-btn">0</button>
            <button
              @click="pickerStore.setPositive()"
              :class="[
                'numpad-btn numpad-action',
                !pickerStore.inputString.startsWith('-') && pickerStore.inputString !== ''
                  ? 'numpad-active'
                  : '',
              ]"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { CheckIcon, XMarkIcon, BackspaceIcon } from '@heroicons/vue/24/solid';
import { usePickerStore } from '@/store/pickerStore';

const pickerStore = usePickerStore();

const isConfirmDisabled = computed(() => {
  return pickerStore.isOutOfRange || pickerStore.inputString === '-';
});
</script>

<style scoped>
@reference '../../assets/tailwind.css';
.numpad-btn {
  @apply h-14 rounded-lg text-xl font-semibold
    text-content
    transition-all
    flex items-center justify-center
    select-none;
  background: linear-gradient(to bottom, #1f2937, #111827);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.numpad-btn:active {
  background: linear-gradient(to bottom, #111827, #0a0f1a);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
  transform: translateY(1px);
}

.numpad-action {
  background: linear-gradient(to bottom, #1f2937, #151c28);
  @apply text-content-muted;
}

.numpad-action:active {
  background: linear-gradient(to bottom, #151c28, #0a0f1a);
}

.numpad-active {
  background: linear-gradient(to bottom, #164e63, #0e3a4a);
  @apply text-accent;
}

.numpad-btn:disabled {
  @apply opacity-30;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
