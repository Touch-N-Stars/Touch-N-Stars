<template>
  <div class="tns-card space-y-3">
    <!-- Header with toggle -->
    <!-- NINA Cache -->
    <div v-if="showNinaCache" class="flex items-center justify-between">
      <span class="text-sm font-normal text-content">{{
        $t('components.framing.useNinaCache')
      }}</span>
      <controlUseNinaCache />
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm font-normal text-content">{{
        $t('components.framing.mosaic.title')
      }}</span>
      <toggleButton
        :status-value="framingStore.isMosaicMode"
        @update:statusValue="framingStore.isMosaicMode = $event"
      />
    </div>

    <!-- Settings — only when active -->
    <div v-if="framingStore.isMosaicMode" class="space-y-3 pt-2 border-t border-line/50">
      <NumberInputPicker
        v-model="framingStore.mosaicCols"
        :label="$t('components.framing.mosaic.columns')"
        labelKey="components.framing.mosaic.columns"
        :min="1"
        :max="20"
        :step="1"
      />
      <NumberInputPicker
        v-model="framingStore.mosaicRows"
        :label="$t('components.framing.mosaic.rows')"
        labelKey="components.framing.mosaic.rows"
        :min="1"
        :max="20"
        :step="1"
      />
      <NumberInputPicker
        v-model="framingStore.mosaicOverlap"
        :label="$t('components.framing.mosaic.overlap')"
        labelKey="components.framing.mosaic.overlap"
        :min="0"
        :max="50"
        :step="5"
      />
      <!-- Preserve Alignment toggle
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <span class="text-xs text-content">{{
            $t('components.framing.mosaic.preserveAlignment')
          }}</span>
          <infoModal
            :title="$t('components.framing.mosaic.preserveAlignmentHelp')"
            :message="$t('components.framing.mosaic.preserveAlignmentHelpText')"
            size="w-4 h-4"
          />
        </div>
        <toggleButton
          :status-value="framingStore.mosaicPreserveAlignment"
          @update:statusValue="framingStore.mosaicPreserveAlignment = $event"
        />
      </div> -->
      <!-- Summary -->
      <div class="text-xs text-content-muted text-center pt-1">
        {{ framingStore.mosaicCols }} × {{ framingStore.mosaicRows }} =
        {{ framingStore.mosaicCols * framingStore.mosaicRows }}
        {{ $t('components.framing.mosaic.panels') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useFramingStore } from '@/store/framingStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import controlUseNinaCache from '@/components/framing/controlUseNinaCache.vue';

// The atlas reuses these controls but draws its own DSS background, so the
// NINA cache toggle is opt-out there.
defineProps({
  showNinaCache: { type: Boolean, default: true },
});

const framingStore = useFramingStore();
</script>
