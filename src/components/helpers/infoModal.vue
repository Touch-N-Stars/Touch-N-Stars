<template>
  <div class="flex items-center">
    <button
      @click="openModal"
      class="text-blue-500 hover:text-gray-300"
      :aria-label="props.title"
      data-testid="info-modal-toggle"
    >
      <component :is="icon" :class="[size, iconTextColour]" />
    </button>
  </div>
  <!-- z-top: Modal teleports to body, and this one opens inside the setup wizard and other
       dialogs. v-if keeps the many closed instances of a page cheap. -->
  <Modal v-if="isModalOpen" show zIndex="z-top" maxWidth="max-w-xl" @close="isModalOpen = false">
    <template #header>
      <h2 class="text-xl font-bold">{{ props.title }}</h2>
    </template>
    <template #body>
      <div class="w-full">
        <p>{{ props.message }}</p>
        <div class="flex items-center gap-2 mt-4" v-if="link && linkText">
          <GlobeAltIcon class="w-6 h-6" />
          <a :href="link" target="_blank" class="text-accent hover:underline">
            {{ linkText }}
          </a>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { InformationCircleIcon, GlobeAltIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';

const props = defineProps({
  title: { type: String, default: 'Info' },
  message: { type: String, default: '' },
  link: { type: String, default: '' },
  linkText: { type: String, default: '' },
  size: { type: String, default: 'w-6 h-6' },
  iconTextColour: { type: String, default: 'text-blue-500' },
  icon: {
    type: [Object, Function], // Accepts component
    default: InformationCircleIcon,
  },
});

const isModalOpen = ref(false);

function openModal() {
  isModalOpen.value = true;
}
</script>
<style scoped></style>
