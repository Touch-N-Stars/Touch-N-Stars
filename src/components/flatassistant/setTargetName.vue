<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-control mb-2">
    <div class="flex flex-row items-center justify-between">
      <span class="text-xs md:text-sm text-content">
        {{ $t('components.flatassistant.set_target_name') }}
      </span>
      <div>
        <toggleButton
          v-model:status-value="settingsStore.flats.targetNameEnabled"
          class="pr-5 pl-5 justify-center h-7 md:h-8"
        />
      </div>
    </div>
    <div class="flex flex-row items-center justify-between mt-2 md:mt-3 gap-2">
      <label for="flatTargetName" class="text-xs md:text-sm text-content">
        {{ $t('components.flatassistant.target_name') }}
      </label>
      <input
        id="flatTargetName"
        v-model="settingsStore.flats.targetName"
        type="text"
        class="tns-input flex-1 text-xs md:text-sm"
        :disabled="!settingsStore.flats.targetNameEnabled"
      />
      <button
        class="flex shrink-0 self-stretch items-center justify-center gap-1.5 px-3 bg-surface-3/60 border border-line-strong rounded-control text-xs md:text-sm text-content hover:bg-surface-3 disabled:opacity-50"
        :disabled="!settingsStore.flats.targetNameEnabled"
        :title="$t('components.flatassistant.target_name_from_favorites')"
        @click="openFavPicker"
      >
        <HeartIcon class="w-5 h-5 text-pink-400" />
      </button>
    </div>
    <Modal :show="showFavPicker" maxWidth="max-w-lg" @close="showFavPicker = false">
      <template #header>
        <span class="text-base font-semibold">
          {{ $t('components.flatassistant.target_name_from_favorites') }}
        </span>
      </template>
      <template #body>
        <div class="w-full">
          <table
            v-if="favStore.favoriteTargets.length"
            class="w-full text-xs text-left border border-line-strong"
          >
            <thead class="bg-surface-3 text-content">
              <tr>
                <th class="px-3 py-2">{{ $t('components.fav_target.table.name') }}</th>
                <th class="px-3 py-2">{{ $t('components.fav_target.table.load') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="target in favStore.favoriteTargets"
                :key="target.Id"
                class="border-t border-line hover:bg-surface-3 transition-colors"
              >
                <td class="px-3 py-2">{{ target.Name }}</td>
                <td class="px-3 py-2">
                  <button class="hover:text-status-ok text-content" @click="applyFavTarget(target)">
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
  </div>
</template>

<script setup>
import { ref } from 'vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import Modal from '@/components/helpers/Modal.vue';
import { HeartIcon, CheckIcon } from '@heroicons/vue/24/outline';
import { useSettingsStore } from '@/store/settingsStore';
import { useFavTargetStore } from '@/store/favTargetsStore';

// Persisting is handled by the debounced deep watcher on settingsStore.flats
// in FlatassistantPage.vue - do not add a second debounce here.
const settingsStore = useSettingsStore();
const favStore = useFavTargetStore();
const showFavPicker = ref(false);

function openFavPicker() {
  favStore.loadFavorites();
  showFavPicker.value = true;
}

function applyFavTarget(target) {
  settingsStore.flats.targetName = target.Name;
  showFavPicker.value = false;
}
</script>
