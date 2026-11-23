<template>
  <div class="space-y-4">
    <!-- Auto-Detection Section -->
    <div class="p-4 bg-surface-3 rounded-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-white">
          {{ t('components.instanceDetection.autoDetectionTitle') }}
        </h3>
        <button @click="detectInstances" :disabled="isDetecting" class="tns-btn-primary max-w-32">
          <span v-if="isDetecting" class="loader w-4 h-4"></span>
          {{
            isDetecting
              ? t('components.instanceDetection.scanningButton')
              : t('components.instanceDetection.scanButton')
          }}
        </button>
      </div>
      <!-- Detection Results -->
      <div v-if="detectionMessage" class="mb-4">
        <div :class="detectionSuccess ? 'text-status-ok' : 'text-status-warn'" class="text-sm">
          {{ detectionMessage }}
        </div>
      </div>
      <!-- No Instance Found Message -->
      <div v-if="showNoInstanceMessage" class="text-content-muted text-sm">
        <p>
          {{ t('components.instanceDetection.noInstanceMessage') }}
        </p>
      </div>
      <div v-else-if="!supportsMdnsDiscovery" class="text-content-muted text-sm">
        <p>
          {{ t('components.instanceDetection.mdnsAvailabilityHint') }}
        </p>
      </div>
    </div>
    <!-- Manual Configuration -->
    <div v-if="!hideManualConfig" class="space-y-4">
      <h3 class="text-lg font-medium text-white">
        {{ t('components.instanceDetection.manualConfigTitle') }}
      </h3>
      <div v-if="!beginner">
        <label class="block text-sm font-medium text-content-muted mb-1">
          {{ t('components.instanceDetection.instanceNameLabel') }}
        </label>
        <input
          v-model="instanceName"
          type="text"
          class="w-full px-3 py-2 bg-surface-3 text-content rounded-md"
          :placeholder="t('components.instanceDetection.instanceNamePlaceholder')"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-content-muted mb-1">
          {{
            beginner
              ? t('components.instanceDetection.rigAddressLabel')
              : t('components.instanceDetection.ipLabel')
          }}
        </label>
        <input
          v-model="instanceIP"
          type="text"
          inputmode="url"
          autocapitalize="off"
          class="w-full px-3 py-2 bg-surface-3 text-content rounded-md"
          :placeholder="t('components.instanceDetection.ipPlaceholder')"
        />
      </div>
      <!-- For beginners the name and the port wait behind "Advanced": the name is only a
           label, and PINS always serves the app on 5000. -->
      <button
        v-if="beginner"
        type="button"
        class="w-full min-h-touch flex items-center gap-2 text-left text-sm text-content-muted"
        :aria-expanded="showAdvanced"
        @click="showAdvanced = !showAdvanced"
      >
        <ChevronRightIcon
          class="w-4 h-4 shrink-0 transition-transform duration-200"
          :class="{ 'rotate-90': showAdvanced }"
        />
        {{ t('components.instanceDetection.advanced') }}
      </button>
      <div v-if="beginner && showAdvanced">
        <label class="block text-sm font-medium text-content-muted mb-1">
          {{ t('components.instanceDetection.instanceNameLabel') }}
        </label>
        <input
          v-model="instanceName"
          type="text"
          class="w-full px-3 py-2 bg-surface-3 text-content rounded-md"
          :placeholder="t('components.instanceDetection.instanceNamePlaceholder')"
        />
      </div>
      <div v-if="!beginner || showAdvanced">
        <label class="block text-sm font-medium text-content-muted mb-1">
          {{ t('components.instanceDetection.portLabel') }}
        </label>
        <input
          v-model="instancePort"
          type="text"
          class="w-full px-3 py-2 bg-surface-3 text-content rounded-md"
          :placeholder="t('components.instanceDetection.portPlaceholder')"
        />
      </div>
    </div>
  </div>

  <!-- Discovery Modal -->
  <Modal
    :show="showDiscoveryModal"
    zIndex="z-top"
    maxWidth="max-w-lg"
    :title="t('components.instanceDetection.modalTitle')"
    @close="closeDiscoveryModal"
  >
    <template #header>
      <div>
        <h2 class="text-xl font-bold">{{ t('components.instanceDetection.modalTitle') }}</h2>
        <p class="text-sm text-content-muted">
          {{ t('components.instanceDetection.modalSubtitle') }}
        </p>
      </div>
    </template>
    <template #body>
      <div class="w-full">
        <div class="mt-6 space-y-4 max-h-80 overflow-y-auto pr-1">
          <div v-if="modalMessage" class="flex items-center space-x-3 text-content">
            <span v-if="isDetecting" class="loader w-4 h-4"></span>
            <span>{{ modalMessage }}</span>
          </div>

          <div
            v-if="discoveryError"
            class="rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
          >
            {{ discoveryError }}
          </div>

          <template v-if="discoveredInstances.length">
            <button
              v-for="instance in discoveredInstances"
              :key="instanceKey(instance)"
              type="button"
              :disabled="!instance.ip || !instance.port"
              @click="handleInstanceSelected(instance)"
              class="w-full rounded-lg border border-line bg-surface-3/40 px-4 py-3 text-left text-sm text-content transition"
              :class="{
                'hover:border-accent hover:bg-surface-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40':
                  instance.ip && instance.port,
                'cursor-not-allowed opacity-60': !instance.ip || !instance.port,
              }"
            >
              <div class="text-base font-semibold text-white">
                {{ instance.label }}
              </div>
              <div class="mt-1 text-sm text-content">
                <span v-if="instance.ip && instance.port">
                  {{ instance.ip }}:{{ instance.port }}
                </span>
                <span v-else class="text-content-muted">
                  {{ t('components.instanceDetection.addressUnavailable') }}
                </span>
              </div>
              <div v-if="instance.hosts.length > 1" class="mt-2 text-xs text-content-faint">
                {{ t('components.instanceDetection.otherAddresses') }} {{ otherHosts(instance) }}
              </div>
            </button>
          </template>

          <div
            v-else-if="!isDetecting && !discoveryError"
            class="rounded-lg border border-line bg-surface-2/80 px-3 py-2 text-sm text-content"
          >
            {{ t('components.instanceDetection.modalEmpty') }}
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import { Capacitor } from '@capacitor/core';
import { mDNS } from '@acovanconis/capacitor-mdns';
import { useI18n } from 'vue-i18n';
import { PINS_HOTSPOT_HOST, probePinsHealth } from '@/services/rigEndpointResolver';
import { PINS_DAEMON_SERVICE_TYPE, mergeDiscoveredServices } from '@/utils/mdnsInstances';

const MDNS_SERVICE_TYPES = ['_touchnstars._tcp', '_pinsdaemon._tcp'];
const MDNS_INSTANCE_PREFIX = 'touchnstars_';
const MDNS_DISCOVERY_TIMEOUT = 6000;

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      name: '',
      ip: '',
      port: 5000,
    }),
  },
  hideManualConfig: {
    type: Boolean,
    default: false,
  },
  // Search as soon as the component shows (native apps only), take a single find over
  // without asking, and try the rig's own hotspot when the network search finds nothing.
  autoDetect: {
    type: Boolean,
    default: false,
  },
  // Address field only; name and port behind "Advanced".
  beginner: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const instanceName = ref(props.modelValue.name);
const instanceIP = ref(props.modelValue.ip);
const instancePort = ref(props.modelValue.port);
const instanceRigId = ref(props.modelValue.rigId || '');
const instanceCandidateHosts = ref(props.modelValue.candidateHosts || []);

const isDetecting = ref(false);
const detectionMessage = ref('');
const detectionSuccess = ref(false);
const showNoInstanceMessage = ref(false);

const showDiscoveryModal = ref(false);
const showAdvanced = ref(false);
const discoveredInstances = ref([]);
const modalMessage = ref('');
const discoveryError = ref('');

const platform = Capacitor.getPlatform();
const supportsMdnsDiscovery =
  Capacitor.isNativePlatform() && (platform === 'android' || platform === 'ios');

// The name a find filled in, so a hand-typed address can drop it again.
let discoveredName = '';

// An address typed by hand that is not one of the found rig's hosts is another backend: the
// found rig's id, hosts and name would otherwise make the app look for the wrong rig later.
watch(instanceIP, (ip) => {
  if (!ip || instanceCandidateHosts.value.includes(ip)) return;
  instanceRigId.value = '';
  instanceCandidateHosts.value = [];
  if (discoveredName && instanceName.value === discoveredName) instanceName.value = '';
  discoveredName = '';
});

watch([instanceName, instanceIP, instancePort, instanceRigId, instanceCandidateHosts], () => {
  emit('update:modelValue', {
    name: instanceName.value,
    ip: instanceIP.value,
    port: instancePort.value,
    rigId: instanceRigId.value,
    candidateHosts: instanceCandidateHosts.value,
  });
});

function instanceKey(instance) {
  return `${instance.label}|${instance.ip}|${instance.port}|${instance.instanceId || ''}`;
}

function otherHosts(instance) {
  if (!Array.isArray(instance.hosts)) {
    return '';
  }
  const unique = Array.from(
    new Set(
      instance.hosts.filter((host) => typeof host === 'string' && host && host !== instance.ip)
    )
  );
  return unique.length
    ? unique.join(', ')
    : t('components.instanceDetection.otherAddressesFallback');
}

function closeDiscoveryModal() {
  showDiscoveryModal.value = false;
}

async function handleInstanceSelected(instance) {
  if (!instance.ip || !instance.port) {
    return;
  }
  instanceName.value = instance.label;
  instanceIP.value = instance.ip;
  instancePort.value = instance.port;
  instanceCandidateHosts.value = Array.from(new Set([instance.ip, ...(instance.hosts || [])]));
  if (instance.sourceType === PINS_DAEMON_SERVICE_TYPE) {
    try {
      const result = await probePinsHealth({ host: instance.ip });
      instanceRigId.value = result.health.rigId;
      // mDNS renames a second announcement of the same host ("pins-503ce-2"); the rig id is
      // the real name, the one its hotspot carries too.
      if (instanceName.value.startsWith(result.health.rigId)) {
        instanceName.value = result.health.rigId;
      }
    } catch (error) {
      console.warn('PINS identity probe failed:', error?.message || error);
    }
  }
  detectionSuccess.value = true;
  detectionMessage.value = t('components.instanceDetection.selectionSuccess', {
    label: instanceName.value,
    ip: instance.ip,
    port: instance.port,
  });
  showNoInstanceMessage.value = false;
  discoveredName = instanceName.value;
  closeDiscoveryModal();
}

/**
 * A rig on its own hotspot is always at the same address. mDNS often does not get through
 * there (or the phone blocks it), so the wizard asks that address directly before it gives up.
 */
async function tryRigHotspot() {
  try {
    const { health } = await probePinsHealth({ host: PINS_HOTSPOT_HOST });
    await handleInstanceSelected({
      label: health.rigId,
      ip: PINS_HOTSPOT_HOST,
      port: 5000,
      hosts: [PINS_HOTSPOT_HOST],
    });
    instanceRigId.value = health.rigId;
    detectionMessage.value = t('components.instanceDetection.hotspotFound', {
      name: health.rigId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * The automatic search of the wizard: no list for a single find, and no dialog to close
 * when nothing turned up. Only several rigs need a choice.
 */
async function autoDetectInstances() {
  if (!supportsMdnsDiscovery || isDetecting.value || instanceIP.value) return;
  isDetecting.value = true;
  detectionSuccess.value = false;
  showNoInstanceMessage.value = false;
  discoveryError.value = '';
  detectionMessage.value = t('components.instanceDetection.scanningMessage');

  await discoverViaMdns();
  const found = discoveredInstances.value;
  if (found.length === 1) {
    await handleInstanceSelected(found[0]);
  } else if (found.length > 1) {
    modalMessage.value = '';
    showDiscoveryModal.value = true;
  } else if (!(await tryRigHotspot())) {
    // A refused search (e.g. no "nearby devices" permission) says why, not just "nothing".
    detectionSuccess.value = false;
    detectionMessage.value = discoveryError.value
      ? t('components.instanceDetection.discoveryFailedStatus', { message: discoveryError.value })
      : t('components.instanceDetection.noFoundMessage');
    showNoInstanceMessage.value = !discoveryError.value;
  }
  isDetecting.value = false;
}

onMounted(() => {
  if (props.autoDetect) autoDetectInstances();
});

async function detectInstances() {
  if (isDetecting.value) {
    return;
  }

  detectionSuccess.value = false;
  showNoInstanceMessage.value = false;
  discoveryError.value = '';
  modalMessage.value = '';

  if (!supportsMdnsDiscovery) {
    detectionMessage.value = t('components.instanceDetection.mdnsRequired');
    showNoInstanceMessage.value = true;
    return;
  }

  showDiscoveryModal.value = true;
  discoveredInstances.value = [];
  modalMessage.value = t('components.instanceDetection.discoveringMessage');
  detectionMessage.value = t('components.instanceDetection.scanningMessage');

  isDetecting.value = true;

  const found = await discoverViaMdns();

  if (!found && !discoveryError.value) {
    detectionMessage.value = t('components.instanceDetection.noFoundMessage');
    showNoInstanceMessage.value = true;
  }

  if (discoveryError.value) {
    showNoInstanceMessage.value = false;
  }

  isDetecting.value = false;
}

async function discoverViaMdns() {
  const collected = [];
  const failures = [];
  let anyScanSucceeded = false;

  // The native mDNS plugin keeps a single discovery listener, so parallel
  // discover() calls cancel each other. Scan one service type at a time.
  for (const type of MDNS_SERVICE_TYPES) {
    let result;
    try {
      result = await mDNS.discover({
        type,
        timeout: MDNS_DISCOVERY_TIMEOUT,
      });
    } catch (error) {
      console.error(`mDNS discovery failed for ${type}:`, error);
      failures.push(error?.message);
      continue;
    }

    if (result?.error) {
      failures.push(result.errorMessage);
      continue;
    }

    anyScanSucceeded = true;
    collected.push(
      ...(result.services || []).map((service) => normalizeMdnsService(service, type))
    );

    // Render what we have so far so the first service type shows up right away
    // while the remaining scans are still running.
    applyDiscoveryResults(collected);
  }

  if (!anyScanSucceeded) {
    const message = enhanceDiscoveryError(failures[0]);
    discoveryError.value = message;
    modalMessage.value = message;
    detectionMessage.value = t('components.instanceDetection.discoveryFailedStatus', {
      message,
    });
    return false;
  }

  const count = applyDiscoveryResults(collected);

  if (count === 0) {
    modalMessage.value = t('components.instanceDetection.modalEmpty');
    return false;
  }

  modalMessage.value = '';
  detectionMessage.value =
    count === 1
      ? t('components.instanceDetection.foundSingle')
      : t('components.instanceDetection.foundMultiple', { count });
  detectionSuccess.value = true;
  return true;
}

function applyDiscoveryResults(services) {
  const normalized = mergeDiscoveredServices(services).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );
  discoveredInstances.value = normalized;
  return normalized.length;
}

function normalizeMdnsService(service, sourceType) {
  const txt = service?.txt || {};
  const { baseName, suffix } = splitInstanceName(service?.name ?? '');
  const ipFromTxt = typeof txt.ip === 'string' ? txt.ip.trim() : '';
  const ipFromHosts = pickPreferredHost(service?.hosts || []);
  const ip = ipFromTxt || ipFromHosts || '';
  const port =
    sourceType === PINS_DAEMON_SERVICE_TYPE
      ? resolvePort(txt.backendPort, 5000)
      : resolvePort(txt.port, service?.port);
  const preferredName =
    (typeof txt.instanceName === 'string' && txt.instanceName.trim()) ||
    baseName ||
    service?.name ||
    '';
  const label = stripInstancePrefix(preferredName);
  const instanceId = (typeof txt.instanceId === 'string' && txt.instanceId.trim()) || suffix || '';
  const rawName = service?.name || preferredName;

  return {
    label,
    ip,
    port,
    instanceId,
    hosts: service?.hosts || [],
    txt,
    rawName,
    sourceType,
  };
}

function splitInstanceName(name) {
  if (typeof name !== 'string') {
    return { baseName: '', suffix: '' };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { baseName: '', suffix: '' };
  }

  const suffixMatch = trimmed.match(/-([0-9a-fA-F]{6})$/);
  const suffix = suffixMatch ? suffixMatch[1] : '';
  const baseWithoutSuffix = suffixMatch
    ? trimmed.slice(0, trimmed.length - suffix.length - 1).trim()
    : trimmed;

  return { baseName: stripInstancePrefix(baseWithoutSuffix), suffix };
}

function stripInstancePrefix(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const prefix = MDNS_INSTANCE_PREFIX;
  const lower = trimmed.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();
  if (lower.startsWith(lowerPrefix)) {
    return trimmed.slice(prefix.length);
  }
  return trimmed;
}

function pickPreferredHost(hosts) {
  if (!Array.isArray(hosts)) {
    return '';
  }
  const ipv4 = hosts.find((host) => typeof host === 'string' && host.includes('.'));
  const firstHost = hosts.find((host) => typeof host === 'string');
  return ipv4 || firstHost || '';
}

function resolvePort(txtPort, fallbackPort) {
  if (typeof txtPort === 'number' && Number.isFinite(txtPort)) {
    return txtPort;
  }
  if (typeof txtPort === 'string') {
    const parsed = parseInt(txtPort, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof fallbackPort === 'number' && Number.isFinite(fallbackPort)) {
    return fallbackPort;
  }
  return 0;
}

function enhanceDiscoveryError(rawMessage) {
  const message = (rawMessage || t('components.instanceDetection.discoveryFailedBase')).trim();
  const lowered = message.toLowerCase();
  if (
    lowered.includes('permission') ||
    lowered.includes('unauthorized') ||
    rawMessage?.includes('NEARBY_WIFI_DEVICES')
  ) {
    return t('components.instanceDetection.discoveryPermissionHintWrapper', { message });
  }
  return message;
}
</script>
<style scoped>
.loader {
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
