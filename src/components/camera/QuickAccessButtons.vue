<template>
  <div :class="quickButtonsClasses">
    <MountButton
      v-if="store.mountInfo.Connected"
      :isActive="showMount"
      @click="emit('open-modal', 'mount')"
    />

    <FocuserButton
      v-if="store.focuserInfo.Connected"
      :isActive="showFocuser"
      @click="emit('open-modal', 'focuser')"
    />

    <FilterButton
      v-if="store.filterInfo.Connected"
      :isActive="showFilter"
      @click="emit('open-modal', 'filter')"
    />

    <RotatorButton
      v-if="store.rotatorInfo.Connected"
      :isActive="showRotator"
      @click="emit('open-modal', 'rotator')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useOrientation } from '@/composables/useOrientation';
import { apiStore } from '@/store/store';
import MountButton from '@/components/helpers/quickAccessButtons/MountButton.vue';
import FocuserButton from '@/components/helpers/quickAccessButtons/FocuserButton.vue';
import FilterButton from '@/components/helpers/quickAccessButtons/FilterButton.vue';
import RotatorButton from '@/components/helpers/quickAccessButtons/RotatorButton.vue';

defineProps({
  showMount: {
    type: Boolean,
    default: false,
  },
  showFocuser: {
    type: Boolean,
    default: false,
  },
  showFilter: {
    type: Boolean,
    default: false,
  },
  showRotator: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['open-modal']);

const store = apiStore();
const { isLandscape } = useOrientation();

const quickButtonsClasses = computed(() => ({
  'fixed flex gap-2 text-content z-10': true,
  'top-24 left-5 flex-col': !isLandscape.value,
  'top-5 left-(--nav-offset) flex-row': isLandscape.value,
}));
</script>

<style scoped>
/* Standard Positioning für alle Geräte */
@media screen and (orientation: landscape) {
  .quickButtonsClasses {
    left: var(--nav-offset) !important;
  }
}

@media (max-height: 600px) and (orientation: landscape) {
  .quickButtonsClasses {
    top: 0.25rem !important;
  }
}
</style>
