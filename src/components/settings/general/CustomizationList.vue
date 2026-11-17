<template>
  <div class="bg-surface-1 rounded-card border border-line">
    <button
      @click="expanded = !expanded"
      class="w-full flex items-center justify-between p-4 text-left gap-3"
    >
      <div class="flex flex-col gap-1 min-w-0 flex-1">
        <h3 class="tns-section-title">{{ title }}</h3>
        <!-- Preview: items fading out when collapsed -->
        <div v-if="!expanded" class="relative overflow-hidden h-20">
          <div class="flex flex-col">
            <div
              v-for="item in localItems.slice(0, 4)"
              :key="item.id"
              class="flex items-center gap-3 py-2 px-3 rounded-md bg-surface-2 mb-2 select-none"
              :class="{ 'opacity-50': isHidden(item.id) }"
            >
              <div class="text-content-muted shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 8h16M4 16h16"
                  />
                </svg>
              </div>
              <span class="flex-1 text-sm text-white">
                {{ item.labelKey ? $t(item.labelKey) : item.label }}
              </span>
              <span v-if="item.alwaysVisible" class="text-xs text-content-faint italic">
                {{ $t('components.settings.itemCustomization.alwaysVisible') }}
              </span>
              <toggleButton v-else :statusValue="!isHidden(item.id)" :disabled="true" />
            </div>
          </div>
          <div
            class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-1/90 to-transparent pointer-events-none"
          />
        </div>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-5 h-5 text-content-muted transition-transform duration-200 shrink-0"
        :class="{ 'rotate-180': expanded }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="expanded" class="px-4 pb-4 flex flex-col gap-3">
      <p class="text-xs text-content-muted">{{ hint }}</p>

      <draggable
        v-model="localItems"
        item-key="id"
        handle=".drag-handle"
        :fallbackOnBody="true"
        ghost-class="opacity-40"
        @end="onReorder"
      >
        <template #item="{ element }">
          <div
            class="flex items-center gap-3 py-2 px-3 rounded-md bg-surface-2 mb-2 select-none"
            :class="{ 'opacity-50': isHidden(element.id) }"
          >
            <!-- Drag handle -->
            <div class="drag-handle cursor-grab active:cursor-grabbing text-content-muted shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>

            <!-- Label -->
            <span class="flex-1 text-sm text-white">
              {{ element.labelKey ? $t(element.labelKey) : element.label }}
            </span>

            <!-- Always visible badge -->
            <span v-if="element.alwaysVisible" class="text-xs text-content-faint italic">
              {{ $t('components.settings.itemCustomization.alwaysVisible') }}
            </span>

            <!-- Toggle -->
            <toggleButton
              v-else
              :statusValue="!isHidden(element.id)"
              :disabled="isLastVisible(element.id)"
              :title="
                isLastVisible(element.id)
                  ? $t('components.settings.itemCustomization.minOneRequired')
                  : ''
              "
              @update:statusValue="toggleItem(element.id)"
            />
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import draggable from 'vuedraggable';
import toggleButton from '@/components/helpers/toggleButton.vue';

// Presentational drag & drop list shared by the navbar and status bar
// customization panels. The parent owns the persisted order and hidden set.
const props = defineProps({
  title: { type: String, required: true },
  hint: { type: String, required: true },
  // Already in display order: [{ id, labelKey?, label?, alwaysVisible? }]
  items: { type: Array, required: true },
  hiddenIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['reorder', 'toggle']);

const expanded = ref(false);

// vuedraggable mutates its v-model, so it gets a local copy of the prop.
const localItems = ref([...props.items]);

watch(
  () => props.items,
  (value) => {
    localItems.value = [...value];
  },
  { deep: true }
);

function onReorder() {
  emit(
    'reorder',
    localItems.value.map((i) => i.id)
  );
}

function isHidden(id) {
  return props.hiddenIds.includes(id);
}

function visibleTogglableCount() {
  return props.items.filter((item) => !item.alwaysVisible && !isHidden(item.id)).length;
}

// The last remaining visible entry cannot be switched off - an empty
// navbar/status bar would leave the user without a way back.
function isLastVisible(id) {
  return !isHidden(id) && visibleTogglableCount() <= 1;
}

function toggleItem(id) {
  if (isLastVisible(id)) return;
  emit('toggle', id);
}
</script>
