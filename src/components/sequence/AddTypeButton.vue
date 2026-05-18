<template>
  <div class="relative" ref="rootRef">
    <button
      class="flex items-center gap-1 px-2 py-1 rounded transition-colors"
      :class="colorClass"
      :title="label"
      :disabled="sequenceStore.sequenceControlsLocked || loading"
      @click.stop="toggle"
    >
      <svg v-if="loading" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <PlusIcon v-else class="w-3.5 h-3.5" />
      <span v-if="containerName" class="text-xs opacity-50">{{ containerName }}</span>
      <span class="text-xs">{{ shortLabel }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed z-[9999] bg-gray-800 border border-slate-600 rounded-lg shadow-xl w-64"
        :style="dropdownStyle"
        @click.stop
      >
        <!-- Search -->
        <div class="p-2 border-b border-slate-700">
          <input
            v-model="search"
            type="text"
            inputmode="search"
            :placeholder="t('components.sequence.addTypeButton.searchPlaceholder')"
            class="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-xs text-gray-200 placeholder-slate-500 outline-none focus:border-cyan-500/50"
            @click.stop
            @focus="updateDropdownPosition"
          />
        </div>

        <!-- Type list -->
        <div class="max-h-64 overflow-y-auto py-1">
          <template v-if="filteredTypes.length">
            <template v-for="(group, cat) in grouped" :key="cat">
              <div class="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {{ cat }}
              </div>
              <button
                v-for="t in group"
                :key="t.FullTypeName"
                class="flex items-center w-full px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60 transition-colors text-left"
                @click="select(t)"
              >
                {{ t.Name }}
              </button>
            </template>
          </template>
          <div v-else class="px-3 py-3 text-xs text-slate-500 text-center">
            {{ t('components.sequence.addTypeButton.noResults') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useSequenceStore } from '@/store/sequenceStore';
import { ITEM_COMPONENTS } from './items/index.js';

const { t } = useI18n();

const props = defineProps({
  targetId: { type: String, required: true },
  mode: { type: String, required: true }, // 'item' | 'trigger' | 'condition'
  insertAfter: { default: true },
  containerName: { type: String, default: '' },
});

const emit = defineEmits(['open-change']);

const store = useSequenceV2Store();
const sequenceStore = useSequenceStore();
const open = ref(false);
const loading = ref(false);
const search = ref('');
const rootRef = ref(null);
const dropdownStyle = ref({});

const label = computed(
  () =>
    ({
      item: t('components.sequence.addTypeButton.addItem'),
      trigger: t('components.sequence.addTypeButton.addTrigger'),
      condition: t('components.sequence.addTypeButton.addCondition'),
    })[props.mode] ?? t('components.sequence.addTypeButton.add')
);

const shortLabel = computed(
  () =>
    ({
      item: t('components.sequence.addTypeButton.item'),
      trigger: t('components.sequence.addTypeButton.trigger'),
      condition: t('components.sequence.addTypeButton.condition'),
    })[props.mode] ?? t('components.sequence.addTypeButton.add')
);

const MODE_COLOR_CLASSES = {
  item: 'text-slate-400 hover:text-slate-200 hover:bg-slate-600/40',
  trigger: 'text-cyan-500/70 hover:text-cyan-400 hover:bg-cyan-900/30',
  condition: 'text-amber-500/70 hover:text-amber-400 hover:bg-amber-900/30',
};

const colorClass = computed(() => [
  MODE_COLOR_CLASSES[props.mode] ?? MODE_COLOR_CLASSES.item,
  sequenceStore.sequenceControlsLocked ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : '',
]);

const types = computed(
  () =>
    ({
      item: store.availableItems,
      trigger: store.availableTriggers,
      condition: store.availableConditions,
    })[props.mode] ?? []
);

const filteredTypes = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = types.value;
  if (props.mode === 'item') {
    list = list.filter((t) => ITEM_COMPONENTS[t.FullTypeName] !== undefined);
  }
  if (!q) return list;
  return list.filter((t) => t.Name?.toLowerCase().includes(q));
});

const grouped = computed(() => {
  const groups = {};
  for (const t of filteredTypes.value) {
    const cat = t.Category ?? 'Sonstige';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  }
  return groups;
});

function updateDropdownPosition() {
  if (!rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  const vvp = window.visualViewport;
  const viewportHeight = vvp ? vvp.height : window.innerHeight;
  const dropdownWidth = 256; // w-64
  const dropdownHeight = 320; // approx max-h-64 + search bar
  let left = rect.right - dropdownWidth;
  if (left < 4) left = 4;
  const spaceBelow = viewportHeight - rect.bottom;
  const top =
    spaceBelow >= dropdownHeight ? rect.bottom + 4 : Math.max(4, rect.top - dropdownHeight - 4);
  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  };
}

async function toggle() {
  if (sequenceStore.sequenceControlsLocked) return;

  if (open.value) {
    open.value = false;
    emit('open-change', false);
    return;
  }
  loading.value = true;
  if (props.mode === 'item') await store.fetchAvailableItems();
  if (props.mode === 'trigger') await store.fetchAvailableTriggers();
  if (props.mode === 'condition') await store.fetchAvailableConditions();
  loading.value = false;
  search.value = '';
  updateDropdownPosition();
  open.value = true;
  emit('open-change', true);
}

async function select(t) {
  if (sequenceStore.sequenceControlsLocked) return;

  open.value = false;
  emit('open-change', false);

  if (t.FullTypeName === 'TNS.Orbitals.OrbitalObjectTarget') {
    store.pendingOrbitalPick = { targetId: props.targetId, insertAfter: props.insertAfter };
    return;
  }

  if (props.mode === 'item') await store.addItem(props.targetId, t.FullTypeName, props.insertAfter);
  if (props.mode === 'trigger')
    await store.addTrigger(props.targetId, t.FullTypeName, props.insertAfter);
  if (props.mode === 'condition')
    await store.addCondition(props.targetId, t.FullTypeName, props.insertAfter);
}

function onOutsideClick(e) {
  if (rootRef.value && !rootRef.value.contains(e.target) && open.value) {
    open.value = false;
    emit('open-change', false);
  }
}
onMounted(() => {
  document.addEventListener('click', onOutsideClick);
  window.visualViewport?.addEventListener('resize', updateDropdownPosition);
});
onUnmounted(() => {
  document.removeEventListener('click', onOutsideClick);
  window.visualViewport?.removeEventListener('resize', updateDropdownPosition);
});
</script>
