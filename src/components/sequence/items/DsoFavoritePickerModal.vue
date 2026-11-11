<template>
  <Modal :show="show" maxWidth="max-w-lg" @close="$emit('close')">
    <template #header>
      <span class="text-base font-semibold">{{
        $t('components.sequence.items.dso.loadFromFavorites')
      }}</span>
    </template>
    <template #body>
      <div class="w-full">
        <table v-if="hasAnyFavTarget" class="w-full text-xs text-left border border-line-strong">
          <thead class="bg-surface-3 text-content-muted">
            <tr>
              <th class="px-3 py-2">{{ $t('components.fav_target.table.name') }}</th>
              <th class="px-3 py-2 hidden sm:table-cell">
                {{ $t('components.fav_target.table.ra') }}
              </th>
              <th class="px-3 py-2 hidden sm:table-cell">
                {{ $t('components.fav_target.table.dec') }}
              </th>
              <th class="px-3 py-2">{{ $t('components.fav_target.table.rotation') }}</th>
              <th class="px-3 py-2">{{ $t('components.fav_target.table.load') }}</th>
            </tr>
          </thead>
          <tbody v-for="group in favTargetGroups" :key="group.key">
            <tr v-if="group.targets.length" class="bg-surface-3/50">
              <td
                colspan="5"
                class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted"
              >
                {{ group.label }}
              </td>
            </tr>
            <tr
              v-for="target in group.targets"
              :key="target.Id"
              class="border-t border-line hover:bg-surface-3 transition-colors"
            >
              <td class="px-3 py-2">
                {{ target.Name }}
                <!-- Same source badge as in FavTargets, which keeps its own color there. -->
                <span
                  v-if="target.source === 'telescopius'"
                  class="ml-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-1.5 py-0.5"
                  >{{ $t('components.fav_target.groups.telescopius') }}</span
                >
                <div v-if="target.listName" class="text-content-muted">{{ target.listName }}</div>
              </td>
              <td class="px-3 py-2 hidden sm:table-cell">{{ target.RaString }}</td>
              <td class="px-3 py-2 hidden sm:table-cell">{{ target.DecString }}</td>
              <td class="px-3 py-2">{{ target.Rotation == null ? '–' : target.Rotation }}</td>
              <td class="px-3 py-2">
                <button
                  class="hover:text-accent text-content-muted"
                  @click="$emit('select', target)"
                >
                  <CheckIcon class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-content-muted">
          {{ $t('components.fav_target.no_fav') }}
        </p>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, watch } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { CheckIcon } from '@heroicons/vue/24/outline';
import { useFavTargetStore } from '@/store/favTargetsStore';
import { useTelescopiusFavorites } from '@/plugins/telescopius/composables/useTelescopiusFavorites';

// Emits `select` with the chosen favorite ({ Name, Ra, Dec, Rotation, ... }); the caller
// writes it into the sequence and closes the dialog.
const props = defineProps({
  show: Boolean,
});

defineEmits(['close', 'select']);

const favStore = useFavTargetStore();
const { loadTelescopiusFavorites, buildTargetGroups } = useTelescopiusFavorites();

// Telescopius targets are merged in for display only - see useTelescopiusFavorites().
const favTargetGroups = computed(() => buildTargetGroups(favStore.favoriteTargets));
const hasAnyFavTarget = computed(() =>
  favTargetGroups.value.some((group) => group.targets.length > 0)
);

// Reloaded on every opening, so favorites added elsewhere in the meantime show up.
watch(
  () => props.show,
  (open) => {
    if (!open) return;
    favStore.loadFavorites();
    loadTelescopiusFavorites();
  }
);
</script>
