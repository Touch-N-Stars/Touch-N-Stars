<template>
  <div class="flex flex-col gap-3">
    <h3 class="font-bold text-base text-accent">
      {{ $t('components.flat.settings.trainedSettings.title') }}
    </h3>

    <div
      v-for="(s, index) in settings"
      :key="index"
      class="p-3 border border-line-strong rounded-lg bg-surface-2/40 flex flex-col gap-3"
    >
      <!-- Header row: title + delete -->
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-base text-accent">#{{ index + 1 }}</h3>
        <button
          @click="confirmRemove(index)"
          class="p-2 text-content-faint hover:text-status-danger transition-colors"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <!-- Filter select -->
      <div class="flex flex-col w-full border border-line-strong p-2 rounded-lg">
        <label class="text-sm sm:text-xs mb-2 text-content">
          {{ $t('components.flat.settings.trainedSettings.filter') }}
        </label>
        <select v-model="s.Filter" @change="saveSetting(index)" class="tns-select w-full py-2">
          <option :value="-1">{{ $t('components.flat.settings.trainedSettings.noFilter') }}</option>
          <option v-for="f in filters" :key="f.Position" :value="f.Position">
            {{ f.Name }}
          </option>
        </select>
      </div>

      <!-- Binning select -->
      <div class="flex flex-col w-full border border-line-strong p-2 rounded-lg">
        <label class="text-sm sm:text-xs mb-2 text-content">
          {{ $t('components.flat.settings.trainedSettings.binning') }}
        </label>
        <select v-model="s.BinningName" @change="saveSetting(index)" class="tns-select w-full py-2">
          <option v-for="b in binningOptions" :key="b" :value="b">{{ b }}</option>
        </select>
      </div>

      <!-- Gain -->
      <NumberInputPicker
        v-model="s.Gain"
        :label="$t('components.flat.settings.trainedSettings.gain')"
        labelKey="components.flat.settings.trainedSettings.gain"
        :min="-1"
        :max="10000"
        :step="1"
        :decimalPlaces="0"
        placeholder="-1"
        wrapperClass="flex-1"
        @change="saveSetting(index)"
      />

      <!-- Offset -->
      <NumberInputPicker
        v-model="s.Offset"
        :label="$t('components.flat.settings.trainedSettings.offset')"
        labelKey="components.flat.settings.trainedSettings.offset"
        :min="-1"
        :max="10000"
        :step="1"
        :decimalPlaces="0"
        placeholder="-1"
        wrapperClass="flex-1"
        @change="saveSetting(index)"
      />

      <!-- Brightness -->
      <NumberInputPicker
        v-model="s.Brightness"
        :label="$t('components.flat.settings.trainedSettings.brightness')"
        labelKey="components.flat.settings.trainedSettings.brightness"
        :min="store.flatdeviceInfo?.MinBrightness || 0"
        :max="store.flatdeviceInfo?.MaxBrightness || 65535"
        :step="1"
        :decimalPlaces="0"
        placeholder="0"
        wrapperClass="flex-1"
        @change="saveSetting(index)"
      />

      <!-- Time -->
      <NumberInputPicker
        v-model="s.Time"
        :label="$t('components.flat.settings.trainedSettings.time')"
        labelKey="components.flat.settings.trainedSettings.time"
        :min="0"
        :max="3600"
        :step="0.01"
        :decimalPlaces="2"
        placeholder="0"
        wrapperClass="flex-1"
        @change="saveSetting(index)"
      />
    </div>

    <!-- Add button -->
    <button
      @click="addSetting"
      class="w-full h-16 border-2 border-dashed border-line-strong hover:border-accent rounded-lg flex items-center justify-center transition-colors"
    >
      <span class="text-4xl text-content-faint hover:text-accent transition-colors">+</span>
    </button>

    <!-- Delete confirmation modal -->
    <Modal :show="showModal" @close="showModal = false" maxWidth="max-w-md">
      <template #header>
        <h2 class="text-lg font-bold text-status-danger">
          {{ $t('components.flat.settings.trainedSettings.confirmTitle') }}
        </h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-content">
            {{ $t('components.flat.settings.trainedSettings.confirmMessage') }}
          </p>
          <div class="flex gap-3 justify-end">
            <button @click="showModal = false" class="tns-btn-secondary">
              {{ $t('common.cancel') }}
            </button>
            <button @click="confirmRemoveSetting" class="tns-btn-danger">
              {{ $t('common.delete') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import Modal from '@/components/helpers/Modal.vue';

const store = apiStore();
const settings = ref([]);
const showModal = ref(false);
const pendingRemoveIndex = ref(null);

const filters = computed(() => {
  return store.profileInfo?.FilterWheelSettings?.FilterWheelFilters ?? [];
});

const binningOptions = ['1x1', '2x2', '3x3', '4x4'];

function binningName(setting) {
  if (setting?.Binning) {
    return `${setting.Binning.X}x${setting.Binning.Y}`;
  }
  return '1x1';
}

async function load() {
  try {
    const response = await apiService.getTrainedFlatSettings();
    if (response?.Success && Array.isArray(response.Response)) {
      settings.value = response.Response.map((s) => ({
        Filter: s.Filter,
        BinningName: binningName(s),
        Gain: s.Gain,
        Offset: s.Offset,
        Brightness: s.Brightness,
        Time: s.Time,
      }));
    }
  } catch (error) {
    console.error('Error loading trained flat settings:', error);
  }
}

async function addSetting() {
  try {
    await apiService.addTrainedFlatSetting();
    await load();
  } catch (error) {
    console.error('Error adding trained flat setting:', error);
  }
}

async function saveSetting(index) {
  try {
    const s = settings.value[index];
    await apiService.updateTrainedFlatSetting(
      index,
      s.Filter,
      s.BinningName,
      s.Gain,
      s.Offset,
      s.Brightness,
      s.Time
    );
  } catch (error) {
    console.error('Error saving trained flat setting:', error);
  }
}

function confirmRemove(index) {
  pendingRemoveIndex.value = index;
  showModal.value = true;
}

async function confirmRemoveSetting() {
  try {
    await apiService.removeTrainedFlatSetting(pendingRemoveIndex.value);
    showModal.value = false;
    pendingRemoveIndex.value = null;
    await load();
  } catch (error) {
    console.error('Error removing trained flat setting:', error);
  }
}

onMounted(() => {
  load();
});
</script>
