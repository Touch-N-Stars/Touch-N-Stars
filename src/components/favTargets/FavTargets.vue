<template>
  <div :class="showBadgeLabel ? 'relative pb-3' : ''">
    <!-- Modal Trigger: floating circle by default, or a labelled row button (variant="button") -->
    <button v-if="variant === 'button'" type="button" class="tns-btn-secondary" @click="openModal">
      <HeartIcon class="w-5 h-5 shrink-0" />
      <span>{{ $t('components.fav_target.titel') }}</span>
    </button>
    <button
      v-else
      @click="openModal"
      class="p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md z-10"
    >
      <HeartIcon class="w-6 h-6 text-white" />
    </button>
    <span
      v-if="showBadgeLabel"
      class="absolute left-1/2 -translate-x-1/2 top-[calc(100%-20px)] text-[8.5px] font-semibold text-white/80 text-center leading-tight bg-slate-900/60 border border-slate-500/30 rounded px-1 py-0.5 whitespace-nowrap"
    >
      Favs
    </span>
    <Modal :show="isModalOpen" zIndex="z-top" @close="isModalOpen = false">
      <template #header>
        <h2 class="text-xl font-bold">{{ $t('components.fav_target.titel') }}</h2>
      </template>
      <template #body>
        <div class="w-full">
          <table
            v-if="hasAnyTarget"
            class="w-full text-sm text-left border border-gray-600 overflow-hidden"
          >
            <thead class="bg-gray-700 text-gray-200">
              <tr>
                <th class="px-4 py-2">{{ $t('components.fav_target.table.name') }}</th>
                <th class="px-4 py-2 hidden sm:table-cell">
                  {{ $t('components.fav_target.table.ra') }}
                </th>
                <th class="px-4 py-2 hidden sm:table-cell">
                  {{ $t('components.fav_target.table.dec') }}
                </th>
                <th class="px-4 py-2">{{ $t('components.fav_target.table.rotation') }}</th>
                <th class="px-4 py-2" v-if="showFramning">
                  {{ $t('components.fav_target.table.load') }}
                </th>
                <th class="px-4 py-2" v-if="showSeqTarget">
                  {{ $t('components.fav_target.table.load') }}
                </th>
                <th class="px-4 py-2">{{ $t('components.fav_target.table.remove') }}</th>
              </tr>
            </thead>
            <tbody v-for="group in targetGroups" :key="group.key">
              <tr v-if="group.targets.length" class="bg-gray-700/50">
                <td
                  :colspan="columnCount"
                  class="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-300"
                >
                  {{ group.label }}
                </td>
              </tr>
              <tr
                v-for="target in group.targets"
                :key="target.Id"
                class="border-t border-gray-700 hover:bg-gray-700 transition-colors"
              >
                <td class="px-4 py-2">
                  {{ target.Name }}
                  <span
                    v-if="target.MosaicCols > 1"
                    class="ml-1 text-xs bg-blue-700 text-white px-1 rounded"
                    >{{ target.MosaicCols }}×{{ target.MosaicRows }}</span
                  >
                  <span
                    v-if="target.source === 'telescopius'"
                    class="ml-1 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-1.5 py-0.5"
                    >{{ $t('components.fav_target.groups.telescopius') }}</span
                  >
                  <div v-if="target.listName" class="text-xs text-gray-400">
                    {{ target.listName }}
                  </div>
                </td>
                <td class="px-4 py-2 hidden sm:table-cell">{{ target.RaString }}</td>
                <td class="px-4 py-2 hidden sm:table-cell">{{ target.DecString }}</td>
                <td class="px-4 py-2">
                  {{ target.Rotation == null ? '–' : Number(target.Rotation).toFixed(1) }}
                </td>
                <td class="px-4 py-2" v-if="showFramning">
                  <button @click="loadTarget(target)" class="hover:text-green-400">
                    <CheckIcon
                      class="w-4 h-4"
                      :class="selectedTargetId === target.Id ? 'text-green-500' : ''"
                    />
                  </button>
                </td>
                <td class="px-4 py-2" v-if="showSeqTarget">
                  <button @click="setSequenceTarget(target)" class="hover:text-green-400">
                    <CheckIcon
                      class="w-4 h-4"
                      :class="selectedTargetId === target.Id ? 'text-green-500' : ''"
                    />
                  </button>
                </td>
                <td class="px-4 py-2">
                  <!-- Telescopius targets are managed in the plugin, not in the favorites. -->
                  <button
                    v-if="target.source !== 'telescopius'"
                    @click="removeTarget(target.Id)"
                    class="hover:text-red-400"
                  >
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <p v-else>{{ $t('components.fav_target.no_fav') }}</p>
        </div>
      </template>
    </Modal>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { useFavTargetStore } from '@/store/favTargetsStore';
import { useFramingStore } from '@/store/framingStore';
import { useSequenceStore } from '@/store/sequenceStore';
import apiService from '@/services/apiService';
import { TrashIcon, CheckIcon, HeartIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import { useToastStore } from '@/store/toastStore';
import { useI18n } from 'vue-i18n';
import { useTelescopiusFavorites } from '@/plugins/telescopius/composables/useTelescopiusFavorites';

const framingStore = useFramingStore();
const favTargetsStore = useFavTargetStore();
const sequenceStore = useSequenceStore();
const selectedTargetId = ref(null);
const isModalOpen = ref(false);
const toastStore = useToastStore();
const { t } = useI18n();
const { loadTelescopiusFavorites, buildTargetGroups } = useTelescopiusFavorites();

const hasSequenceLoaded = computed(
  () =>
    sequenceStore.sequenceIsLoaded &&
    Array.isArray(sequenceStore.sequenceInfo) &&
    sequenceStore.sequenceInfo.length > 0
);

const props = defineProps({
  showSeqTarget: {
    type: Boolean,
    default: true,
  },
  showBadgeLabel: {
    type: Boolean,
    default: false,
  },
  showFramning: {
    type: Boolean,
    default: true,
  },
  // 'fab' = floating cyan circle | 'button' = labelled tns-btn-secondary row button
  variant: {
    type: String,
    default: 'fab',
  },
});

// Telescopius targets are merged in for display only - see useTelescopiusFavorites().
const targetGroups = computed(() => buildTargetGroups(favTargetsStore.favoriteTargets));

const hasAnyTarget = computed(() => targetGroups.value.some((group) => group.targets.length > 0));

// Name, RA, DEC, Rotation and Remove are always rendered; framing and sequence are optional.
const columnCount = computed(
  () => 5 + (props.showFramning ? 1 : 0) + (props.showSeqTarget ? 1 : 0)
);

function loadTarget(target) {
  framingStore.RAangle = target.Ra;
  framingStore.DECangle = target.Dec;
  framingStore.RAangleString = target.RaString;
  framingStore.DECangleString = target.DecString;
  framingStore.rotationAngle = target.Rotation ?? 0;
  framingStore.selectedItem = {
    Name: target.Name,
    RA: target.Ra,
    Dec: target.Dec,
  };
  if (target.MosaicCols > 1) {
    framingStore.isMosaicMode = true;
    framingStore.mosaicCols = target.MosaicCols;
    framingStore.mosaicRows = target.MosaicRows;
    framingStore.mosaicOverlap = target.MosaicOverlap;
    framingStore.mosaicPreserveAlignment = target.MosaicPreserveAlignment ?? true;
  } else {
    framingStore.isMosaicMode = false;
  }
  selectedTargetId.value = target.Id;
  // Framing-Bild neu laden falls die Framing-Seite gerade aktiv ist.
  framingStore.framingReloadKey++;
}

// Reload both sources from the backend on every open so freshly imported or refreshed
// Telescopius lists show up without a page reload.
function openModal() {
  favTargetsStore.loadFavorites();
  loadTelescopiusFavorites();
  isModalOpen.value = true;
}

function removeTarget(id) {
  console.log('Remove', id);
  favTargetsStore.removeFavorite(id);
}

async function setSequenceTarget(target) {
  console.log('Setting sequence target', target);

  const Name = target.Name;
  const Ra = target.Ra;
  const Dec = target.Dec;
  const Rotation = target.Rotation || 0;
  const Index = 0;

  console.log('Name:', Name, 'RA:', Ra, 'Dec:', Dec, 'Rotation:', Rotation);

  if (!hasSequenceLoaded.value) {
    console.error('No sequence loaded');
    toastStore.showToast({
      type: 'error',
      title: t('components.fav_target.modal_sequence.titel'),
      message: t('components.fav_target.modal_sequence_error.message'),
    });
    return;
  }
  try {
    await apiService.sequnceTargetSet(Name, Ra, Dec, Rotation, Index);
    console.log('Sequence target updated successfully.');
    toastStore.showToast({
      type: 'success',
      title: t('components.fav_target.modal_sequence.titel'),
      message: t('components.fav_target.modal_sequence_ok.message'),
    });
  } catch (error) {
    console.error('Error setting sequence target:', error);
    toastStore.showToast({
      type: 'error',
      title: t('components.fav_target.modal_sequence.titel'),
      message:
        error?.response?.data?.Message || t('components.fav_target.modal_sequence_error.message'),
    });
  }
}

onMounted(() => {
  favTargetsStore.loadFavorites();
});
</script>
