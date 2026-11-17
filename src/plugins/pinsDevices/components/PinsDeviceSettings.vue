<template>
  <div>
    <div v-if="store.isAnyDeviceConnected" class="container py-10 overflow-x-hidden">
      <div class="max-w-4xl mx-auto space-y-5">
        <!-- Header Section -->
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-white">{{ t('plugins.pinsDevices.title') }}</h2>
          <div class="flex flex-wrap justify-between w-full gap-x-4 gap-y-1 mt-1">
            <span class="text-gray-400 text-sm">
              {{ t('plugins.pinsDevices.settings.temperature') }}
              {{
                store.isPowerboxConnected &&
                typeof store.powerboxStatus.Temperature === 'number' &&
                store.powerboxStatus.Temperature !== undefined &&
                !isNaN(store.powerboxStatus.Temperature)
                  ? store.powerboxStatus.Temperature.toFixed(1)
                  : store.isMeteostationConnected &&
                      typeof store.meteoStationStatus.Temperature === 'number' &&
                      store.meteoStationStatus.Temperature !== undefined &&
                      !isNaN(store.meteoStationStatus.Temperature)
                    ? store.meteoStationStatus.Temperature.toFixed(1)
                    : '--'
              }}°C
            </span>
            <span class="text-gray-400 text-sm">
              {{ t('plugins.pinsDevices.settings.humidity') }}
              {{
                store.isPowerboxConnected &&
                typeof store.powerboxStatus.Humidity === 'number' &&
                store.powerboxStatus.Humidity !== undefined &&
                !isNaN(store.powerboxStatus.Humidity)
                  ? store.powerboxStatus.Humidity.toFixed(1)
                  : store.isMeteostationConnected &&
                      typeof store.meteoStationStatus.Humidity === 'number' &&
                      store.meteoStationStatus.Humidity !== undefined &&
                      !isNaN(store.meteoStationStatus.Humidity)
                    ? store.meteoStationStatus.Humidity.toFixed(1)
                    : '--'
              }}%
            </span>
            <span class="text-gray-400 text-sm">
              {{ t('plugins.pinsDevices.settings.dewPoint') }}
              {{
                store.isPowerboxConnected &&
                typeof store.powerboxStatus.DewPoint === 'number' &&
                store.powerboxStatus.DewPoint !== undefined &&
                !isNaN(store.powerboxStatus.DewPoint)
                  ? store.powerboxStatus.DewPoint.toFixed(1)
                  : store.isMeteostationConnected &&
                      typeof store.meteoStationStatus.DewPoint === 'number' &&
                      store.meteoStationStatus.DewPoint !== undefined &&
                      !isNaN(store.meteoStationStatus.DewPoint)
                    ? store.meteoStationStatus.DewPoint.toFixed(1)
                    : '--'
              }}°C
            </span>
          </div>
        </div>

        <!-- Tabs Container -->
        <div
          class="border border-gray-700 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg"
        >
          <!-- Tab Buttons -->
          <div class="relative">
            <div
              ref="mainTabBar"
              class="flex overflow-x-auto border-b border-gray-700 scrollbar-hide"
              @scroll="onMainTabScroll"
            >
              <button
                class="px-4 py-3 text-sm font-semibold whitespace-nowrap shrink-0"
                :class="
                  activeTab === 'general'
                    ? 'text-white border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-white'
                "
                data-tab="general"
                @click="setActiveTab('general')"
              >
                {{ t('plugins.pinsDevices.settings.general') }}
              </button>

              <button
                :disabled="!store.isPowerboxConnected"
                class="px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap shrink-0"
                :class="{
                  'text-white border-b-2 border-cyan-400': activeTab === 'ports',
                  'text-gray-400 hover:text-white':
                    activeTab !== 'ports' && store.isPowerboxConnected,
                  'text-gray-600 cursor-not-allowed': !store.isPowerboxConnected,
                }"
                data-tab="ports"
                @click="store.isPowerboxConnected && setActiveTab('ports')"
              >
                {{ t('plugins.pinsDevices.settings.ports') }}
              </button>

              <button
                :disabled="!store.isMeteostationConnected"
                class="px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap shrink-0"
                :class="{
                  'text-white border-b-2 border-cyan-400': activeTab === 'weather',
                  'text-gray-400 hover:text-white':
                    activeTab !== 'weather' && store.isMeteostationConnected,
                  'text-gray-600 cursor-not-allowed': !store.isMeteostationConnected,
                }"
                data-tab="weather"
                @click="store.isMeteostationConnected && setActiveTab('weather')"
              >
                {{ t('plugins.pinsDevices.settings.weather') }}
              </button>

              <button
                :disabled="!store.isLensControlConnected"
                class="px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap shrink-0"
                :class="{
                  'text-white border-b-2 border-cyan-400': activeTab === 'lenscontrol',
                  'text-gray-400 hover:text-white':
                    activeTab !== 'lenscontrol' && store.isLensControlConnected,
                  'text-gray-600 cursor-not-allowed': !store.isLensControlConnected,
                }"
                data-tab="lenscontrol"
                @click="store.isLensControlConnected && setActiveTab('lenscontrol')"
              >
                {{ t('plugins.pinsDevices.settings.lensControl') }}
              </button>

              <button
                class="px-4 py-3 text-sm font-semibold whitespace-nowrap shrink-0"
                :class="
                  activeTab === 'configuration'
                    ? 'text-white border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-white'
                "
                data-tab="configuration"
                @click="setActiveTab('configuration')"
              >
                {{ t('plugins.pinsDevices.settings.configuration') }}
              </button>
            </div>
            <!-- Left fade indicator -->
            <div
              v-if="mainTabCanScrollLeft"
              class="absolute left-0 top-0 bottom-0 w-10 pointer-events-none rounded-tl-xl"
              style="background: linear-gradient(to left, transparent, rgba(31, 41, 55, 0.95))"
            ></div>
            <!-- Right fade indicator -->
            <div
              v-if="mainTabCanScrollRight"
              class="absolute right-0 top-0 bottom-0 w-10 pointer-events-none rounded-tr-xl"
              style="background: linear-gradient(to right, transparent, rgba(31, 41, 55, 0.95))"
            ></div>
          </div>

          <!-- Tab Content -->
          <div class="p-5">
            <!-- General Tab -->
            <div v-show="activeTab === 'general'">
              <PinsDeviceGeneralTab />
            </div>

            <!-- Ports Tab with Sub-tabs -->
            <div v-show="activeTab === 'ports'" class="space-y-4">
              <!-- Ports Sub-Tab Buttons -->
              <div class="border border-gray-700 rounded-lg bg-gray-800/50">
                <div class="relative">
                  <div
                    ref="portsSubTabBar"
                    class="flex overflow-x-auto border-b border-gray-700 scrollbar-hide"
                    @scroll="onPortsSubTabScroll"
                  >
                    <button
                      v-if="hasPowerPorts"
                      class="px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0"
                      :class="
                        activePortsSubTab === 'power'
                          ? 'text-white border-b-2 border-cyan-400'
                          : 'text-gray-400 hover:text-white'
                      "
                      data-subtab="power"
                      @click="setActivePortsSubTab('power')"
                    >
                      {{ t('plugins.pinsDevices.settings.powerPorts') }}
                    </button>
                    <button
                      v-if="hasUsbPorts"
                      class="px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0"
                      :class="
                        activePortsSubTab === 'usb'
                          ? 'text-white border-b-2 border-cyan-400'
                          : 'text-gray-400 hover:text-white'
                      "
                      data-subtab="usb"
                      @click="setActivePortsSubTab('usb')"
                    >
                      {{ t('plugins.pinsDevices.settings.usbPorts') }}
                    </button>
                    <button
                      v-if="hasDewPorts"
                      class="px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0"
                      :class="
                        activePortsSubTab === 'dew'
                          ? 'text-white border-b-2 border-cyan-400'
                          : 'text-gray-400 hover:text-white'
                      "
                      data-subtab="dew"
                      @click="setActivePortsSubTab('dew')"
                    >
                      {{ t('plugins.pinsDevices.settings.dewPorts') }}
                    </button>
                    <button
                      v-if="hasAdjustablePorts"
                      class="px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0"
                      :class="
                        activePortsSubTab === 'adjustable'
                          ? 'text-white border-b-2 border-cyan-400'
                          : 'text-gray-400 hover:text-white'
                      "
                      data-subtab="adjustable"
                      @click="setActivePortsSubTab('adjustable')"
                    >
                      {{ t('plugins.pinsDevices.settings.adjustablePower') }}
                    </button>
                  </div>
                  <!-- Left fade indicator -->
                  <div
                    v-if="portsSubTabCanScrollLeft"
                    class="absolute left-0 top-0 bottom-0 w-10 pointer-events-none rounded-tl-lg"
                    style="
                      background: linear-gradient(to left, transparent, rgba(17, 24, 39, 0.95));
                    "
                  ></div>
                  <!-- Right fade indicator -->
                  <div
                    v-if="portsSubTabCanScrollRight"
                    class="absolute right-0 top-0 bottom-0 w-10 pointer-events-none rounded-tr-lg"
                    style="
                      background: linear-gradient(to right, transparent, rgba(17, 24, 39, 0.95));
                    "
                  ></div>
                </div>

                <!-- Ports Sub-Tab Content -->
                <div class="p-4">
                  <div v-show="activePortsSubTab === 'power'">
                    <PinsDeviceSwitchPortsTab kind="power" />
                  </div>
                  <div v-show="activePortsSubTab === 'usb'">
                    <PinsDeviceSwitchPortsTab kind="usb" />
                  </div>
                  <div v-show="activePortsSubTab === 'dew'">
                    <PinsDeviceDewPortsTab />
                  </div>
                  <div v-show="activePortsSubTab === 'adjustable'">
                    <PinsDeviceAdjustablePowerTab />
                  </div>
                </div>
              </div>
            </div>

            <!-- Weather Tab -->
            <div v-show="activeTab === 'weather'">
              <PinsDeviceWeatherTab />
            </div>

            <!-- LensControl Tab -->
            <div v-show="activeTab === 'lenscontrol'">
              <PinsDeviceLensControlTab />
            </div>

            <!-- Configuration Tab -->
            <div v-show="activeTab === 'configuration'">
              <PinsDeviceConfigurationTab :active="activeTab === 'configuration'" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Device Connected Message -->
    <div v-else class="container py-10 overflow-x-hidden">
      <div class="max-w-4xl mx-auto">
        <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p class="text-red-400 font-medium text-center">
            {{ $t('plugins.pinsDevices.status.notConnected') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import PinsDeviceGeneralTab from './PinsDeviceGeneralTab.vue';
import PinsDeviceSwitchPortsTab from './PinsDeviceSwitchPortsTab.vue';
import PinsDeviceDewPortsTab from './PinsDeviceDewPortsTab.vue';
import PinsDeviceAdjustablePowerTab from './PinsDeviceAdjustablePowerTab.vue';
import PinsDeviceWeatherTab from './PinsDeviceWeatherTab.vue';
import PinsDeviceLensControlTab from './PinsDeviceLensControlTab.vue';
import PinsDeviceConfigurationTab from './PinsDeviceConfigurationTab.vue';
import { usePinsDeviceStore } from '../store/pinsDevicesStore.js';

const { t } = useI18n();
const store = usePinsDeviceStore();
const activeTab = ref('general');
const activePortsSubTab = ref('power');

const mainTabBar = ref(null);
const portsSubTabBar = ref(null);
const mainTabCanScrollRight = ref(false);
const mainTabCanScrollLeft = ref(false);
const portsSubTabCanScrollRight = ref(false);
const portsSubTabCanScrollLeft = ref(false);

const checkScrollable = (el, canScrollLeftRef, canScrollRightRef) => {
  if (!el) return;
  canScrollLeftRef.value = el.scrollLeft > 1;
  canScrollRightRef.value = el.scrollWidth > el.clientWidth + el.scrollLeft + 1;
};

const onMainTabScroll = () =>
  checkScrollable(mainTabBar.value, mainTabCanScrollLeft, mainTabCanScrollRight);
const onPortsSubTabScroll = () =>
  checkScrollable(portsSubTabBar.value, portsSubTabCanScrollLeft, portsSubTabCanScrollRight);

const hasPowerPorts = computed(() => store.powerPorts.MaxPorts > 0);
const hasUsbPorts = computed(() => store.usbPorts.MaxPorts > 0);
const hasDewPorts = computed(() => store.dewPorts.MaxPorts > 0);
const hasAdjustablePorts = computed(
  () => store.buckPorts.MaxPorts > 0 || store.pwmPorts.MaxPorts > 0
);

const scrollTabIntoView = (bar, selector, value) => {
  if (!bar) return;
  const btn = bar.querySelector(`[${selector}="${value}"]`);
  if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  const isMain = selector === 'data-tab';
  nextTick(() =>
    checkScrollable(
      bar,
      isMain ? mainTabCanScrollLeft : portsSubTabCanScrollLeft,
      isMain ? mainTabCanScrollRight : portsSubTabCanScrollRight
    )
  );
};

const setActiveTab = (tab) => {
  activeTab.value = tab;
  nextTick(() => scrollTabIntoView(mainTabBar.value, 'data-tab', tab));
};

const setActivePortsSubTab = (subTab) => {
  activePortsSubTab.value = subTab;
  nextTick(() => scrollTabIntoView(portsSubTabBar.value, 'data-subtab', subTab));
};

const initPortsSubTab = () => {
  if (hasPowerPorts.value) activePortsSubTab.value = 'power';
  else if (hasUsbPorts.value) activePortsSubTab.value = 'usb';
  else if (hasDewPorts.value) activePortsSubTab.value = 'dew';
  else if (hasAdjustablePorts.value) activePortsSubTab.value = 'adjustable';
};

onMounted(async () => {
  await store.loadAllData();
  initPortsSubTab();
  await nextTick();
  checkScrollable(mainTabBar.value, mainTabCanScrollLeft, mainTabCanScrollRight);
  checkScrollable(portsSubTabBar.value, portsSubTabCanScrollLeft, portsSubTabCanScrollRight);
});
</script>
