<template>
  <div v-if="!store.focuserInfo.Connected" class="text-status-danger">
    <p>{{ $t('components.focuser.please_connect_focuser') }}</p>
  </div>
  <div
    v-else
    :class="
      compact
        ? 'flex flex-wrap items-center gap-x-5 gap-y-2'
        : 'grid grid-cols-2 landscape:grid-cols-3 gap-2'
    "
  >
    <StatusString
      :compact="compact"
      :isEnabled="store.focuserInfo.Position !== ''"
      :Name="$t('components.focuser.current_position')"
      :Value="store.focuserInfo.Position"
    />
    <StatusString
      :compact="compact"
      :isEnabled="isTemperatureEnabled"
      :Name="$t('components.focuser.temperature')"
      :Value="formattedTemperature"
    />
    <StatusBool
      :compact="compact"
      :isEnabled="store.focuserInfo.IsMoving"
      :enabledText="$t('components.focuser.moving')"
      :disabledText="$t('components.focuser.stopped')"
    />
    <StatusBool
      :compact="compact"
      :isEnabled="store.focuserAfInfo.autofocus_running"
      :enabledText="$t('components.focuser.autofocus_active')"
      :disabledText="$t('components.focuser.autofocus')"
    />
    <template v-if="store.isPINS && focuserStore.focuserSettings">
      <StatusBool
        v-if="focuserStore.focuserSettings.IsStalled !== undefined"
        :compact="compact"
        :isEnabled="focuserStore.focuserSettings.IsStalled"
        :enabledText="$t('components.focuser.IsStalled')"
        :disabledText="$t('components.focuser.IsStalled')"
        :state="focuserStore.focuserSettings.IsStalled ? 'danger' : 'idle'"
      />
      <StatusString
        v-if="focuserStore.focuserSettings.HeatingPower !== undefined"
        :compact="compact"
        secondary
        :Name="$t('components.focuser.HeatingPower')"
        :Value="focuserStore.focuserSettings.HeatingPower + ' %'"
      />
      <StatusString
        v-if="focuserStore.focuserSettings.BoardTemperature !== undefined"
        :compact="compact"
        secondary
        :Name="$t('components.focuser.BoardTemperature')"
        :Value="focuserStore.focuserSettings.BoardTemperature?.toFixed(1) + ' °C'"
      />
      <StatusBool
        v-if="focuserStore.focuserSettings.DcPower !== undefined"
        :compact="compact"
        :isEnabled="focuserStore.focuserSettings.DcPower"
        :enabledText="$t('components.focuser.DcPower')"
        :disabledText="$t('components.focuser.DcPower')"
      />
      <StatusString
        v-if="
          focuserStore.focuserSettings.StepSize !== undefined &&
          focuserStore.focuserSettings.StepSize !== -1 &&
          !isNaN(focuserStore.focuserSettings.StepSize)
        "
        :compact="compact"
        secondary
        :isEnabled="true"
        :Name="$t('components.focuser.StepSize')"
        :Value="focuserStore.focuserSettings.StepSize.toFixed(4) + ' µm'"
      />
      <StatusString
        v-if="
          focuserStore.focuserSettings.MaxStep !== undefined &&
          focuserStore.focuserSettings.MaxStep !== -1 &&
          !isNaN(focuserStore.focuserSettings.MaxStep)
        "
        :compact="compact"
        secondary
        :isEnabled="true"
        :Name="$t('components.focuser.settings.MaxStep')"
        :Value="focuserStore.focuserSettings.MaxStep"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import StatusBool from '@/components/helpers/StatusBool.vue';
import StatusString from '@/components/helpers/StatusString.vue';
import { apiStore } from '@/store/store';
import { useFocuserStore } from '@/store/focuserStore';
const store = apiStore();
const focuserStore = useFocuserStore();

// Dense page layout: inline state chips + two value columns.
const { compact } = defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
});

// Computed properties für die Temperatur
const isTemperatureEnabled = computed(() => {
  const temp = store.focuserInfo.Temperature;
  if (temp == null || isNaN(temp)) {
    return false; // Temperatur ist nicht gültig
  }
  return true; // Temperatur ist gültig
});
const formattedTemperature = computed(() => {
  const temp = store.focuserInfo.Temperature;
  if (temp == null || isNaN(temp)) {
    return 'N/A'; // Fallback zu 'N/A' bei ungültigen Werten
  }
  return temp.toFixed(2) + ' °C'; // Formatierte Temperatur
});
</script>
