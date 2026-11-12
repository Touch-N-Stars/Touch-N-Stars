<template>
  <div class="space-y-4">
    <!-- Error Message -->
    <div v-if="store.error" class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
      <p class="text-red-400 font-medium">{{ store.error }}</p>
    </div>

    <!-- Ports Grid -->
    <div v-if="ports.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        v-for="port in ports"
        :key="port.Index"
        class="border rounded-lg p-4 transition-all"
        :class="[
          port.Enabled ? 'border-green-500/50 bg-green-500/10' : 'border-gray-600 bg-gray-800/30',
          port.Overcurrent ? 'border-red-500/50 bg-red-500/10' : '',
        ]"
      >
        <!-- Port Header with Editable Name -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex-1">
            <div v-if="editingPortIndex !== port.Index" class="flex items-center gap-2">
              <h4 class="font-semibold text-white">{{ port.Name }}</h4>
              <button
                @click="startEditingName(port.Index)"
                class="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
                :title="$t('common.edit')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <input
                :value="editingPortName"
                @input="editingPortName = $event.target.value"
                @keyup.enter="savePortName(port.Index)"
                @keyup.escape="cancelEditingName()"
                type="text"
                class="flex-1 px-2 py-1 bg-gray-700 border border-cyan-500/50 rounded text-white text-sm focus:outline-none focus:border-cyan-400"
                autofocus
              />
              <button
                @click="savePortName(port.Index)"
                :disabled="isRenamingPort"
                class="p-1 text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
                :title="$t('common.confirm')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </button>
              <button
                @click="cancelEditingName()"
                class="p-1 text-red-400 hover:text-red-300 transition-colors"
                :title="$t('common.cancel')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Status Indicator -->
            <span
              class="inline-block w-2 h-2 rounded-full"
              :class="port.Enabled ? 'bg-green-500' : 'bg-gray-500'"
            ></span>
            <!-- Overcurrent Indicator -->
            <span
              v-if="port.Overcurrent"
              class="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 font-semibold"
            >
              {{ $t('plugins.pinsDevices.ports.overcurrent') }}
            </span>
          </div>
        </div>

        <!-- Port Info -->
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">{{ $t('plugins.pinsDevices.ports.status') }}</span>
            <span :class="port.Enabled ? 'text-green-400' : 'text-gray-500'">
              {{ port.Enabled ? $t('common.enabled') : $t('common.disabled') }}
            </span>
          </div>

          <div v-if="kind === 'usb' && Number.isFinite(port.Voltage)" class="flex justify-between">
            <span class="text-gray-400">{{ $t('plugins.pinsDevices.ports.voltage') }}</span>
            <span class="text-gray-200">{{ port.Voltage.toFixed(2) }}V</span>
          </div>

          <div v-if="Number.isFinite(port.Current)" class="flex justify-between">
            <span class="text-gray-400">{{ $t('plugins.pinsDevices.ports.current') }}</span>
            <span class="text-gray-200">{{ port.Current.toFixed(2) }}A</span>
          </div>

          <div
            v-if="port.MaxCurrent !== 'NaN' && port.MaxCurrent !== undefined && port.MaxCurrent > 0"
            class="flex justify-between"
          >
            <span class="text-gray-400">{{ $t('plugins.pinsDevices.ports.maxCurrent') }}</span>
            <span class="text-gray-200">{{ port.MaxCurrent.toFixed(2) }}A</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-400">{{ $t('plugins.pinsDevices.ports.bootState') }}</span>
            <span :class="port.BootState ? 'text-blue-400' : 'text-gray-500'">
              {{
                port.BootState
                  ? $t('plugins.pinsDevices.ports.bootStateEnabled')
                  : $t('plugins.pinsDevices.ports.bootStateDisabled')
              }}
            </span>
          </div>
        </div>

        <!-- Boot State Toggle & Control Button -->
        <div class="mt-4 space-y-2">
          <button
            v-if="!port.ReadOnly"
            @click="toggleBootState(port)"
            :disabled="isTogglingBootState"
            class="w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all"
            :class="
              port.BootState
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50'
            "
          >
            {{
              isTogglingBootState
                ? $t('common.loading')
                : port.BootState
                  ? 'Disable on startup'
                  : 'Enable on startup'
            }}
          </button>
          <div
            v-else
            class="w-full py-2 px-3 rounded-lg text-xs text-center bg-blue-700/30 text-blue-300"
          >
            Always enabled on startup (read-only)
          </div>
          <button
            v-if="!port.ReadOnly"
            @click="togglePort(port)"
            :disabled="isToggling"
            class="w-full py-2 px-3 rounded-lg text-sm font-semibold transition-all"
            :class="
              port.Enabled
                ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'
            "
          >
            {{
              isToggling
                ? $t('common.loading')
                : port.Enabled
                  ? $t('common.disable')
                  : $t('common.enable')
            }}
          </button>
          <div
            v-else
            class="w-full py-2 px-3 rounded-lg text-sm text-center bg-gray-700/50 text-gray-300"
          >
            {{ $t('plugins.pinsDevices.ports.readOnly') }}
          </div>
        </div>
      </div>
    </div>

    <!-- No Ports Message -->
    <div v-else class="p-4 text-center text-gray-400">
      {{ $t('plugins.pinsDevices.ports.noPorts') }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePinsDeviceStore } from '../store/pinsDevicesStore.js';

// Power and USB ports share one layout; only the store slice and setters differ.
const props = defineProps({
  kind: {
    type: String,
    required: true,
    validator: (value) => ['power', 'usb'].includes(value),
  },
});

const store = usePinsDeviceStore();

const ports = computed(() =>
  props.kind === 'usb' ? store.usbPorts.Ports : store.powerPorts.Ports
);

const setPortName = (index, name) =>
  props.kind === 'usb' ? store.setUsbPortName(index, name) : store.setPowerPortName(index, name);
const setPortState = (index, enabled) =>
  props.kind === 'usb'
    ? store.setUsbPortState(index, enabled)
    : store.setPowerPortState(index, enabled);
const setPortBootState = (index, enabled) =>
  props.kind === 'usb'
    ? store.setUsbPortBootState(index, enabled)
    : store.setPowerPortBootState(index, enabled);

const isToggling = ref(false);
const isTogglingBootState = ref(false);
const isRenamingPort = ref(false);
const editingPortIndex = ref(null);
const editingPortName = ref('');

const startEditingName = (portIndex) => {
  const port = ports.value.find((p) => p.Index === portIndex);
  if (port) {
    editingPortIndex.value = portIndex;
    editingPortName.value = port.Name;
  }
};

const cancelEditingName = () => {
  editingPortIndex.value = null;
  editingPortName.value = '';
};

const savePortName = async (portIndex) => {
  if (!editingPortName.value.trim()) {
    cancelEditingName();
    return;
  }

  isRenamingPort.value = true;
  const success = await setPortName(portIndex, editingPortName.value);
  if (!success) {
    console.error('Failed to rename port');
  }
  isRenamingPort.value = false;
  cancelEditingName();
};

const togglePort = async (port) => {
  isToggling.value = true;
  const success = await setPortState(port.Index, !port.Enabled);
  if (!success) {
    console.error('Failed to toggle port');
  }
  isToggling.value = false;
};

const toggleBootState = async (port) => {
  isTogglingBootState.value = true;
  const success = await setPortBootState(port.Index, !port.BootState);
  if (!success) {
    console.error('Failed to toggle boot state');
  }
  isTogglingBootState.value = false;
};
</script>
