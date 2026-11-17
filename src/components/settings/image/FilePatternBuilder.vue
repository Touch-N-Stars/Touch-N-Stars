<template>
  <div class="flex flex-col gap-3">
    <!-- LIGHT pattern editor -->
    <PatternEditorCore v-model="lightPattern" v-model:showTokens="showLightTokens" />

    <!-- Save button (visible when light token editor is open) -->
    <button
      v-if="showLightTokens"
      @click="savePattern"
      class="tns-btn-primary w-full mt-1"
      :class="{ 'glow-green': saveSuccess }"
      :disabled="saving"
    >
      {{ $t('components.settings.save') }}
    </button>

    <!-- Advanced Settings toggle -->
    <button
      @click="showAdvanced = !showAdvanced"
      class="flex items-center justify-between w-full text-xs text-content-muted hover:text-content transition-colors"
    >
      <span>{{ $t('components.settings.imageFile.advancedSettings') }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': showAdvanced }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Advanced section: DARK, FLAT, BIAS -->
    <div v-if="showAdvanced" class="flex flex-col gap-3">
      <!-- DARK panel -->
      <div class="flex flex-col gap-2 p-3 bg-ground/40 border border-line rounded-lg">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-content">
            {{ $t('components.settings.imageFile.darks') }}
          </label>
          <label class="flex items-center gap-2 text-xs text-content-muted cursor-pointer">
            <input type="checkbox" v-model="darkUsesLight" class="rounded" />
            {{ $t('components.settings.imageFile.useLightPattern') }}
          </label>
        </div>
        <div
          v-if="darkUsesLight"
          class="bg-ground/50 border border-line rounded-lg px-3 py-2 font-mono text-xs text-accent/60 break-all"
        >
          {{ darkPreviewResult || '—' }}
        </div>
        <PatternEditorCore v-else v-model="darkPattern" v-model:showTokens="showDarkTokens" />
      </div>

      <!-- BIAS panel -->
      <div class="flex flex-col gap-2 p-3 bg-ground/40 border border-line rounded-lg">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-content">
            {{ $t('components.settings.imageFile.bias') }}
          </label>
          <label class="flex items-center gap-2 text-xs text-content-muted cursor-pointer">
            <input type="checkbox" v-model="biasUsesLight" class="rounded" />
            {{ $t('components.settings.imageFile.useLightPattern') }}
          </label>
        </div>
        <div
          v-if="biasUsesLight"
          class="bg-ground/50 border border-line rounded-lg px-3 py-2 font-mono text-xs text-accent/60 break-all"
        >
          {{ biasPreviewResult || '—' }}
        </div>
        <PatternEditorCore v-else v-model="biasPattern" v-model:showTokens="showBiasTokens" />
      </div>

      <!-- FLAT panel -->
      <div class="flex flex-col gap-2 p-3 bg-ground/40 border border-line rounded-lg">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-content">
            {{ $t('components.settings.imageFile.flats') }}
          </label>
          <label class="flex items-center gap-2 text-xs text-content-muted cursor-pointer">
            <input type="checkbox" v-model="flatUsesLight" class="rounded" />
            {{ $t('components.settings.imageFile.useLightPattern') }}
          </label>
        </div>
        <div
          v-if="flatUsesLight"
          class="bg-ground/50 border border-line rounded-lg px-3 py-2 font-mono text-xs text-accent/60 break-all"
        >
          {{ flatPreviewResult || '—' }}
        </div>
        <PatternEditorCore v-else v-model="flatPattern" v-model:showTokens="showFlatTokens" />
      </div>

      <!-- Save button in advanced section -->
      <button
        @click="savePattern"
        class="tns-btn-primary w-full"
        :class="{ 'glow-green': saveSuccess }"
        :disabled="saving"
      >
        {{ $t('components.settings.save') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import PatternEditorCore from './PatternEditorCore.vue';
import { defaultPattern, exampleValues } from './patternConstants.js';

const store = apiStore();
const saving = ref(false);
const saveSuccess = ref(false);

// LIGHT pattern
const lightPattern = ref('');
const showLightTokens = ref(false);

// Advanced section toggle
const showAdvanced = ref(false);

// Per-type state
const darkUsesLight = ref(true);
const darkPattern = ref('');
const showDarkTokens = ref(false);

const biasUsesLight = ref(true);
const biasPattern = ref('');
const showBiasTokens = ref(false);

const flatUsesLight = ref(true);
const flatPattern = ref('');
const showFlatTokens = ref(false);

function buildPreview(raw, imageType) {
  if (!raw) return '';
  let result = raw;
  for (const [token, value] of Object.entries(exampleValues)) {
    result = result.replaceAll(token, value);
  }
  return result.replaceAll(exampleValues['$$IMAGETYPE$$'], imageType);
}

const darkPreviewResult = computed(() => buildPreview(lightPattern.value, 'DARK'));
const biasPreviewResult = computed(() => buildPreview(lightPattern.value, 'BIAS'));
const flatPreviewResult = computed(() => buildPreview(lightPattern.value, 'FLAT'));

function initFromSettings(settings) {
  const lightVal = settings.FilePattern || defaultPattern;
  lightPattern.value = lightVal;

  const darkVal = settings.FilePatternDARK || '';
  if (darkVal && darkVal !== lightVal) {
    darkUsesLight.value = false;
    darkPattern.value = darkVal;
  } else {
    darkUsesLight.value = true;
    darkPattern.value = lightVal;
  }

  const biasVal = settings.FilePatternBIAS || '';
  if (biasVal && biasVal !== lightVal) {
    biasUsesLight.value = false;
    biasPattern.value = biasVal;
  } else {
    biasUsesLight.value = true;
    biasPattern.value = lightVal;
  }

  const flatVal = settings.FilePatternFLAT || '';
  if (flatVal && flatVal !== lightVal) {
    flatUsesLight.value = false;
    flatPattern.value = flatVal;
  } else {
    flatUsesLight.value = true;
    flatPattern.value = lightVal;
  }
}

async function savePattern() {
  saving.value = true;
  saveSuccess.value = false;
  try {
    await apiService.profileChangeValue('ImageFileSettings-FilePattern', lightPattern.value);
    await apiService.profileChangeValue(
      'ImageFileSettings-FilePatternDARK',
      darkUsesLight.value ? lightPattern.value : darkPattern.value
    );
    await apiService.profileChangeValue(
      'ImageFileSettings-FilePatternBIAS',
      biasUsesLight.value ? lightPattern.value : biasPattern.value
    );
    await apiService.profileChangeValue(
      'ImageFileSettings-FilePatternFLAT',
      flatUsesLight.value ? lightPattern.value : flatPattern.value
    );
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 1500);
  } catch (error) {
    console.error('[FilePatternBuilder] Error saving pattern:', error);
  } finally {
    saving.value = false;
  }
}

// Flag: once the profile has loaded and we initialized, don't overwrite user changes
let initialized = false;

onMounted(() => {
  const settings = store.profileInfo.ImageFileSettings;
  initFromSettings(settings);
  if (settings.FilePattern) {
    initialized = true;
  }
});

// Re-init only once when profile loads asynchronously (e.g. first connect to NINA)
watch(
  () => store.profileInfo.ImageFileSettings.FilePattern,
  (val) => {
    if (!initialized && val) {
      initFromSettings(store.profileInfo.ImageFileSettings);
      initialized = true;
    }
  }
);
</script>
