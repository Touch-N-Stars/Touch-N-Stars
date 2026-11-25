<template>
  <div class="flex flex-col gap-3">
    <!-- Changing the driver restarts it; with the mount connected that would cut the
         connection in the middle of whatever it is doing. -->
    <p
      v-if="mountConnected"
      class="rounded-control border border-status-warn/40 bg-status-warn/10 p-3 text-sm text-content"
    >
      {{ t('components.mountDriverFinder.disconnectFirst') }}
    </p>

    <!-- 1. Which mount? -->
    <template v-if="!selectedModel">
      <label class="flex flex-col gap-1" for="mount-driver-finder-search">
        <span class="tns-label">{{ t('components.mountDriverFinder.searchLabel') }}</span>
        <input
          id="mount-driver-finder-search"
          v-model="query"
          type="search"
          class="tns-input"
          :placeholder="t('components.mountDriverFinder.searchPlaceholder')"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>

      <div v-if="!query.trim()" class="flex flex-col gap-2">
        <span class="text-xs text-content-muted">
          {{ t('components.mountDriverFinder.vendorHint') }}
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="vendor in vendors"
            :key="vendor"
            type="button"
            class="tns-btn-secondary w-auto! px-3! text-xs!"
            @click="query = vendor"
          >
            {{ vendor }}
          </button>
        </div>
      </div>

      <ul v-else-if="results.length" class="flex flex-col gap-2">
        <li v-for="model in results" :key="model.id">
          <button
            type="button"
            class="flex w-full min-h-touch items-center gap-2 rounded-control border border-line bg-surface-2 px-3 py-2 text-left"
            @click="selectModel(model)"
          >
            <span class="flex-1 min-w-0">
              <span class="block text-xs text-content-muted">{{ model.vendor }}</span>
              <span class="block text-sm font-semibold text-content break-words">
                {{ model.model }}
              </span>
            </span>
            <ChevronRightIcon class="w-5 h-5 shrink-0 text-content-muted" />
          </button>
        </li>
      </ul>

      <p v-else class="text-sm text-content-muted">
        {{ t('components.mountDriverFinder.noMatch') }}
      </p>
    </template>

    <!-- 2. How is it connected, and which driver does that need? -->
    <template v-else>
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <span class="block text-xs text-content-muted">{{ selectedModel.vendor }}</span>
          <span class="block font-semibold text-content break-words">
            {{ selectedModel.model }}
          </span>
        </div>
        <button
          type="button"
          class="tns-btn-ghost px-2! text-xs! shrink-0"
          :disabled="busy"
          @click="resetModel"
        >
          {{ t('components.mountDriverFinder.otherMount') }}
        </button>
      </div>

      <span class="tns-label">{{ t('components.mountDriverFinder.howConnected') }}</span>
      <div role="radiogroup" class="flex flex-col gap-2">
        <button
          v-for="(connection, index) in selectedModel.connections"
          :key="connection.id"
          type="button"
          role="radio"
          :aria-checked="connection.id === selectedConnection?.id"
          class="flex w-full min-h-touch flex-col gap-1 rounded-control border p-3 text-left"
          :class="
            connection.id === selectedConnection?.id
              ? 'border-accent bg-accent/10'
              : 'border-line bg-surface-2'
          "
          :disabled="busy"
          @click="selectConnection(connection)"
        >
          <span class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-content">
              {{ t(`components.mountDriverFinder.connections.${connection.id}.title`) }}
            </span>
            <span
              v-if="index === 0 && selectedModel.connections.length > 1"
              class="rounded-chip bg-accent/20 px-2 py-0.5 text-xs text-content"
            >
              {{ t('components.mountDriverFinder.recommended') }}
            </span>
          </span>
          <span class="text-xs text-content-muted">
            {{ t(`components.mountDriverFinder.connections.${connection.id}.hint`) }}
          </span>
          <span class="text-xs text-content-faint">
            {{ t('components.mountDriverFinder.driverName', { name: driverLabel(connection) }) }}
          </span>
        </button>
      </div>

      <!-- Driver state and the one action that fits it -->
      <div v-if="loadingDrivers" class="flex items-center gap-2 text-sm text-content-muted">
        <Spinner size="sm" />{{ t('components.mountDriverFinder.checking') }}
      </div>

      <template v-else-if="driverListFailed">
        <p class="text-sm text-status-danger">
          {{ t('components.mountDriverFinder.driverListFailed') }}
        </p>
        <button type="button" class="tns-btn-secondary" @click="loadInstalledDrivers">
          {{ t('components.mountDriverFinder.retry') }}
        </button>
      </template>

      <!-- Hidden once a driver was set: the result box below says what to do next. -->
      <template v-else-if="selectedConnection && !resultText">
        <p v-if="isCurrentDriver" class="text-sm text-content-muted">
          {{ t('components.mountDriverFinder.alreadySet') }}
        </p>

        <button
          v-if="availability === 'installed'"
          type="button"
          :class="isCurrentDriver ? 'tns-btn-secondary' : 'tns-btn-primary'"
          :disabled="busy || mountConnected"
          @click="useDriver"
        >
          <Spinner v-if="phase === 'applying'" size="sm" />
          {{ t('components.mountDriverFinder.useDriver') }}
        </button>

        <template v-else-if="availability === 'installable'">
          <p class="text-sm text-content-muted">
            {{ t('components.mountDriverFinder.needsInstall', { name: driverLabel() }) }}
          </p>
          <div
            v-if="confirmInstall"
            class="flex flex-col gap-2 rounded-control border border-line p-3"
          >
            <p class="text-sm text-content">
              {{ t('components.mountDriverFinder.installConfirm', { name: driverLabel() }) }}
            </p>
            <div class="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                class="tns-btn-primary"
                :disabled="busy || mountConnected"
                @click="installAndUse"
              >
                {{ t('components.mountDriverFinder.installConfirmYes') }}
              </button>
              <button type="button" class="tns-btn-secondary" @click="confirmInstall = false">
                {{ t('components.mountDriverFinder.cancel') }}
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="tns-btn-primary"
            :disabled="busy || mountConnected"
            @click="confirmInstall = true"
          >
            <Spinner v-if="phase === 'installing' || phase === 'applying'" size="sm" />
            {{ t('components.mountDriverFinder.installAndUse') }}
          </button>
        </template>

        <p v-else class="text-sm text-content-muted">
          {{ t('components.mountDriverFinder.unavailable', { name: driverLabel() }) }}
        </p>
      </template>

      <div v-if="progressText" class="flex items-center gap-2 text-sm text-content-muted">
        <Spinner size="sm" />{{ progressText }}
      </div>

      <div
        v-if="resultText"
        class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
      >
        <span class="tns-dot bg-status-ok mt-1.5"></span>
        <p class="text-sm text-content">{{ resultText }}</p>
      </div>

      <p v-if="errorText" class="text-sm text-status-danger break-words">{{ errorText }}</p>
    </template>

    <!-- 3. Not in the table: the full driver list and the package search, as before. Hidden
         while the mount is connected - those change the driver just the same. -->
    <template v-if="showFallback && !mountConnected">
      <button
        type="button"
        class="tns-btn-ghost justify-start! px-0! text-sm!"
        :aria-expanded="showAllDrivers"
        @click="showAllDrivers = !showAllDrivers"
      >
        <ChevronDownIcon
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-180': showAllDrivers }"
        />
        {{ t('components.mountDriverFinder.notListed') }}
      </button>
      <div v-if="showAllDrivers" class="flex flex-col gap-3">
        <IndiDriverSelect
          ref="driverSelect"
          deviceType="telescope"
          listAction="mountAction"
          profileSection="TelescopeSettings"
          :label="t('components.setupWizard.mount.selectDriver')"
          :connected="mountConnected"
        />
        <p class="text-sm text-content-muted">
          {{ t('components.setupWizard.mount.notFoundHint') }}
        </p>
        <Indi3rdpartyInstallPanel
          search-seed="mount"
          label-prefix="components.setupWizard.mount"
          @installed="onFallbackInstalled"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import Spinner from '@/components/helpers/Spinner.vue';
import IndiDriverSelect from '@/components/setupWizard/IndiDriverSelect.vue';
import Indi3rdpartyInstallPanel from '@/components/setupWizard/Indi3rdpartyInstallPanel.vue';
import { extractIndiInstallErrorDetail } from '@/components/pins/composables/indiInstallUtils';
import { installIndiDriver } from '@/components/pins/composables/installIndiDriver';
import { applyIndiDriver } from '@/utils/equipmentDevices';
import {
  MOUNT_DRIVERS,
  driverAvailability,
  mountDriverLabel,
  mountVendors,
  searchMountModels,
} from '@/utils/mountDriverCatalog';

/**
 * "Which driver does my mount need?" for PINS: the user searches for their mount, says how
 * it is cabled, and gets the matching INDI driver selected - installed first if PINS does
 * not ship it. The full INDI driver list stays reachable behind "not listed?".
 *
 * Used by the setup wizard, the equipment page's INDI setup and the simple mode start page.
 */
defineProps({
  // Show the full driver list and the package search below the finder. Off where the host
  // already shows the plain driver list (equipment page INDI setup).
  showFallback: { type: Boolean, default: true },
});

const emit = defineEmits(['applied', 'busy']);

const { t } = useI18n();
const store = apiStore();

const vendors = mountVendors();
const query = ref('');
const selectedModel = ref(null);
const selectedConnection = ref(null);

// Names from the plugin's INDI mount driver list; null until loaded.
const installedDrivers = ref(null);
const loadingDrivers = ref(false);
const driverListFailed = ref(false);

// idle | installing | applying
const phase = ref('idle');
const confirmInstall = ref(false);
const progressText = ref('');
const resultText = ref('');
const errorText = ref('');
const showAllDrivers = ref(false);
const driverSelect = ref(null);

const results = computed(() => searchMountModels(query.value));
const mountConnected = computed(() => Boolean(store.mountInfo?.Connected));
const busy = computed(() => phase.value !== 'idle');
const availability = computed(() =>
  selectedConnection.value
    ? driverAvailability(selectedConnection.value.driver, installedDrivers.value || [])
    : null
);
const isCurrentDriver = computed(
  () =>
    Boolean(selectedConnection.value) &&
    store.profileInfo?.TelescopeSettings?.IndiDriver === selectedConnection.value.driver
);

watch(busy, (value) => emit('busy', value));

function driverLabel(connection = selectedConnection.value) {
  return connection ? mountDriverLabel(connection.driver) : '';
}

function clearMessages() {
  confirmInstall.value = false;
  progressText.value = '';
  resultText.value = '';
  errorText.value = '';
}

function selectModel(model) {
  selectedModel.value = model;
  // The first connection is the recommended one.
  selectedConnection.value = model.connections[0] || null;
  clearMessages();
}

function selectConnection(connection) {
  selectedConnection.value = connection;
  clearMessages();
}

function resetModel() {
  selectedModel.value = null;
  selectedConnection.value = null;
  clearMessages();
}

async function loadInstalledDrivers() {
  loadingDrivers.value = true;
  driverListFailed.value = false;
  try {
    const response = await apiPinsService.getINDIDeviceList('telescope');
    if (!Array.isArray(response?.Response)) throw new Error(response?.Error || 'no list');
    installedDrivers.value = response.Response.map((driver) => driver.Name);
  } catch (error) {
    console.error('[MountDriverFinder] INDI driver list failed:', error);
    driverListFailed.value = true;
  } finally {
    loadingDrivers.value = false;
  }
}

async function applyDriver(driver) {
  phase.value = 'applying';
  progressText.value = t('components.mountDriverFinder.applying', {
    name: mountDriverLabel(driver),
  });
  try {
    const { deviceId } = await applyIndiDriver('mountAction', driver);
    resultText.value = deviceId
      ? t('components.mountDriverFinder.applied', {
          name: mountDriverLabel(driver),
          device: deviceId,
        })
      : t('components.mountDriverFinder.appliedPickDevice', { name: mountDriverLabel(driver) });
    // The plain driver list below shows the profile's driver; keep it in step.
    driverSelect.value?.loadDrivers();
    emit('applied', { driver, deviceId });
  } catch (error) {
    console.error('[MountDriverFinder] applying driver failed:', error);
    errorText.value = t('components.mountDriverFinder.applyFailed', {
      message: error?.message || '',
    });
  } finally {
    progressText.value = '';
    phase.value = 'idle';
  }
}

async function useDriver() {
  if (busy.value || mountConnected.value || !selectedConnection.value) return;
  clearMessages();
  await applyDriver(selectedConnection.value.driver);
}

async function installAndUse() {
  const connection = selectedConnection.value;
  if (busy.value || mountConnected.value || !connection) return;
  const driver = connection.driver;
  const packageName = MOUNT_DRIVERS[driver]?.package;
  if (!packageName) return;

  clearMessages();
  phase.value = 'installing';
  progressText.value = t('components.mountDriverFinder.installing', {
    name: mountDriverLabel(driver),
  });

  try {
    const result = await installIndiDriver({
      packageName,
      type: 'telescope',
      label: mountDriverLabel(driver),
    });
    if (result !== 'installed') {
      errorText.value = t(`components.mountDriverFinder.${result}`, { name: packageName });
      return;
    }

    await loadInstalledDrivers();
    if (!installedDrivers.value?.includes(driver)) {
      errorText.value = t('components.mountDriverFinder.installedButMissing', {
        name: mountDriverLabel(driver),
      });
      return;
    }
    progressText.value = '';
    await applyDriver(driver);
  } catch (error) {
    console.error('[MountDriverFinder] install failed:', error);
    errorText.value = t('components.mountDriverFinder.installFailed', {
      message: extractIndiInstallErrorDetail(error),
    });
  } finally {
    progressText.value = '';
    phase.value = 'idle';
  }
}

async function onFallbackInstalled() {
  driverSelect.value?.loadDrivers();
  await loadInstalledDrivers();
}

onMounted(loadInstalledDrivers);
</script>
