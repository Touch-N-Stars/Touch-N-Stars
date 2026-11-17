<template>
  <section class="tns-card space-y-3">
    <h2 class="font-semibold text-content">{{ $t('plugins.coneError.settings.title') }}</h2>
    <!-- Each field saves on its own change, like the other TNS settings; fixed while a session runs. -->
    <fieldset class="space-y-3" :disabled="store.active">
      <NumberInputPicker
        v-model="form.sunExclusionDegrees"
        @change="saveField('sunExclusionDegrees')"
        inputId="cone-sun-radius"
        :label="$t('plugins.coneError.settings.sunRadius')"
        labelKey="plugins.coneError.settings.sunRadius"
        :helpMessage="$t('plugins.coneError.settings.sunRadiusHelp')"
        :min="15"
        :max="90"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <NumberInputPicker
        v-model="form.autoMinAltitudeDegrees"
        @change="saveField('autoMinAltitudeDegrees')"
        inputId="cone-auto-min-alt"
        :label="$t('plugins.coneError.settings.autoMinAltitude')"
        labelKey="plugins.coneError.settings.autoMinAltitude"
        :min="0"
        :max="80"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <NumberInputPicker
        v-model="form.manualMinAltitudeDegrees"
        @change="saveField('manualMinAltitudeDegrees')"
        inputId="cone-manual-min-alt"
        :label="$t('plugins.coneError.settings.manualMinAltitude')"
        labelKey="plugins.coneError.settings.manualMinAltitude"
        :min="-10"
        :max="80"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <label class="flex items-start gap-3 min-h-touch text-sm text-content">
        <input
          v-model="form.strictPath"
          type="checkbox"
          class="w-5 h-5 mt-0.5"
          @change="saveField('strictPath')"
        />
        <span>
          {{ $t('plugins.coneError.settings.strictPath') }}
          <span class="block text-xs text-content-muted">
            {{ $t('plugins.coneError.settings.strictPathHelp') }}
          </span>
        </span>
      </label>
      <p class="text-xs text-content-faint">{{ $t('plugins.coneError.settings.limitsNote') }}</p>
    </fieldset>
  </section>
</template>

<script setup>
import { reactive, watch } from 'vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useConeErrorStore } from '../store/coneErrorStore';

const store = useConeErrorStore();
const form = reactive({
  sunExclusionDegrees: 30,
  autoMinAltitudeDegrees: 20,
  manualMinAltitudeDegrees: 0,
  strictPath: false,
});

watch(
  () => store.settings,
  (settings) => {
    if (!settings) return;
    form.sunExclusionDegrees = settings.sunExclusionDegrees;
    form.autoMinAltitudeDegrees = settings.autoMinAltitudeDegrees;
    form.manualMinAltitudeDegrees = settings.manualMinAltitudeDegrees;
    form.strictPath = settings.strictPath;
  },
  { immediate: true }
);

async function saveField(key) {
  try {
    await store.saveSettings({ [key]: form[key] });
  } catch {
    // shown through store.error
  }
}
</script>
