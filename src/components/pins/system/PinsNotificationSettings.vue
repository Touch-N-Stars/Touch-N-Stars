<template>
  <section v-if="store.isPINS" class="tns-card flex flex-col gap-3" :aria-busy="loading || saving">
    <h3 class="tns-section-title">{{ t(`${k}.title`) }}</h3>
    <p class="text-sm text-content-muted">{{ t(`${k}.description`) }}</p>

    <p
      v-if="sessionNotificationState.relayAvailable === false"
      role="status"
      class="text-sm text-status-warning"
    >
      {{ t(`${k}.relayUnavailable`) }}
    </p>

    <template v-else>
      <!-- This phone -->
      <div class="flex flex-col gap-3">
        <h4 class="text-sm font-semibold text-content">{{ t(`${k}.phoneTitle`) }}</h4>

        <div v-if="backgroundSupported" class="flex flex-col gap-2">
          <div class="tns-field-row">
            <div class="flex items-center gap-1">
              <span class="text-sm text-content">{{ t(`${k}.background`) }}</span>
              <InfoModal
                :title="t(`${k}.background`)"
                :message="t(isIos ? `${k}.backgroundInfoIos` : `${k}.backgroundInfo`)"
                size="w-4 h-4"
              />
            </div>
            <ToggleButton
              :statusValue="settingsStore.sessionNotifications.background"
              @update:statusValue="toggleBackground"
            />
          </div>
          <p
            v-if="settingsStore.sessionNotifications.background && monitor"
            role="status"
            class="text-xs flex items-center gap-2"
            :class="monitor.connected ? 'text-status-success' : 'text-content-muted'"
          >
            <span
              class="tns-dot"
              :class="monitor.connected ? 'bg-status-ok' : 'bg-status-warn'"
              aria-hidden="true"
            ></span>
            {{ t(monitor.connected ? `${k}.monitorConnected` : `${k}.monitorConnecting`) }}
          </p>
          <div
            v-if="
              settingsStore.sessionNotifications.background &&
              monitor &&
              !monitor.ignoringBatteryOptimizations
            "
            class="flex flex-col gap-2"
          >
            <p class="text-xs text-status-warning">{{ t(`${k}.batteryHint`) }}</p>
            <button class="tns-btn-secondary sm:w-auto!" @click="openBatterySettings">
              {{ t(`${k}.batteryButton`) }}
            </button>
          </div>
          <!-- iOS runs the background connection only on these Wi-Fi networks -->
          <div
            v-if="isIos && settingsStore.sessionNotifications.background"
            class="flex flex-col gap-2"
          >
            <p class="text-xs text-content-muted break-words">
              {{
                rigSsids.length
                  ? t(`${k}.ssidList`, { ssids: rigSsids.join(', ') })
                  : t(`${k}.noSsid`)
              }}
            </p>
            <button v-if="rigSsids.length" class="tns-btn-secondary sm:w-auto!" @click="resetSsids">
              {{ t(`${k}.ssidReset`) }}
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-content-muted">{{ t(`${k}.backgroundUnsupported`) }}</p>

        <div class="tns-field-row">
          <span class="text-sm text-content">{{ t(`${k}.catchUp`) }}</span>
          <ToggleButton
            :statusValue="settingsStore.sessionNotifications.catchUp"
            @update:statusValue="settingsStore.setSessionNotifications({ catchUp: $event })"
          />
        </div>

        <label class="flex flex-col gap-1">
          <span class="tns-label">{{ t(`${k}.minSeverity`) }}</span>
          <select
            class="tns-select"
            :value="settingsStore.sessionNotifications.minSeverity"
            @change="settingsStore.setSessionNotifications({ minSeverity: $event.target.value })"
          >
            <option v-for="option in severityOptions" :key="option" :value="option">
              {{ t(`${k}.severity.${option}`) }}
            </option>
          </select>
        </label>

        <p v-if="sessionNotificationState.error" role="alert" class="text-sm text-status-danger">
          {{ sessionNotificationState.error }}
        </p>
      </div>

      <!-- The rig (pinsdaemon) -->
      <div v-if="rig" class="flex flex-col gap-3 border-t border-line pt-3">
        <h4 class="text-sm font-semibold text-content">{{ t(`${k}.rigTitle`) }}</h4>

        <div class="tns-field-row">
          <span class="text-sm text-content">{{ t(`${k}.includeSystem`) }}</span>
          <ToggleButton
            :statusValue="rig.includeSystem"
            @update:statusValue="rig.includeSystem = $event"
          />
        </div>

        <NumberInputPicker
          v-model="rig.temperatureThresholdC"
          :label="t(`${k}.temperatureThreshold`)"
          :labelKey="`${k}.temperatureThreshold`"
          :min="40"
          :max="110"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          inputId="pins-notify-temperature"
          labelPosition="top"
          wrapperClass="w-full"
        />
        <NumberInputPicker
          v-model="rig.diskFreeThresholdGb"
          :label="t(`${k}.diskThreshold`)"
          :labelKey="`${k}.diskThreshold`"
          :min="0"
          :max="500"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          inputId="pins-notify-disk"
          labelPosition="top"
          wrapperClass="w-full"
        />

        <div class="tns-field-row">
          <div class="flex items-center gap-1">
            <span class="text-sm text-content">{{ t(`${k}.ntfy`) }}</span>
            <InfoModal :title="t(`${k}.ntfy`)" :message="t(`${k}.ntfyInfo`)" size="w-4 h-4" />
          </div>
          <ToggleButton
            :statusValue="rig.ntfy.enabled"
            @update:statusValue="rig.ntfy.enabled = $event"
          />
        </div>
        <template v-if="rig.ntfy.enabled">
          <label class="flex flex-col gap-1">
            <span class="tns-label">{{ t(`${k}.ntfyUrl`) }}</span>
            <input
              v-model.trim="rig.ntfy.url"
              class="tns-input"
              type="url"
              inputmode="url"
              autocomplete="off"
              placeholder="https://ntfy.sh/my-rig-topic"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="tns-label">
              {{ t(rig.ntfy.hasToken ? `${k}.ntfyTokenSet` : `${k}.ntfyToken`) }}
            </span>
            <input
              v-model="ntfyToken"
              class="tns-input"
              type="password"
              autocomplete="off"
              :placeholder="rig.ntfy.hasToken ? '••••••••' : ''"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="tns-label">{{ t(`${k}.ntfyMinSeverity`) }}</span>
            <select v-model="rig.ntfy.minSeverity" class="tns-select">
              <option v-for="option in severityOptions" :key="option" :value="option">
                {{ t(`${k}.severity.${option}`) }}
              </option>
            </select>
          </label>
        </template>

        <p v-if="saved" role="status" class="text-sm text-status-success">
          {{ t(`${k}.saved`) }}
        </p>
        <p v-if="testSent" role="status" class="text-sm text-status-success">
          {{ t(`${k}.testSent`, { seconds: TEST_DELAY_SECONDS }) }}
        </p>
        <p v-if="errorMessage" role="alert" class="text-sm text-status-danger break-words">
          {{ errorMessage }}
        </p>
        <div class="flex flex-col sm:flex-row gap-2">
          <button class="tns-btn-primary" :disabled="saving || loading" @click="save">
            {{ t(saving ? `${k}.saving` : `${k}.save`) }}
          </button>
          <button class="tns-btn-secondary" :disabled="saving || testing" @click="sendTest">
            {{ t(`${k}.test`) }}
          </button>
        </div>
      </div>
      <p v-else-if="loading" class="text-sm text-content-muted">{{ t(`${k}.loading`) }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import apiPinsService from '@/services/apiPinsService';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { SessionMonitor } from '@/utils/sessionMonitor';
import { SEVERITIES } from '@/utils/sessionNotifications';
import {
  isBackgroundMonitorSupported,
  refreshMonitorStatus,
  resetRigSsids,
  sessionNotificationState,
} from '@/services/sessionNotificationService';

const k = 'components.settings.sessionNotifications';
// The phone only shows rig notifications while the app is not in the foreground.
const TEST_DELAY_SECONDS = 10;
const { t } = useI18n();
const store = apiStore();
const settingsStore = useSettingsStore();

// 'success' is only meaningful as part of "everything"; offer three levels.
const severityOptions = SEVERITIES.filter((severity) => severity !== 'success');
const backgroundSupported = isBackgroundMonitorSupported();
const isIos = Capacitor.getPlatform() === 'ios';
const rigSsids = computed(
  () => settingsStore.sessionNotifications.ssidsByHost?.[settingsStore.connection.ip] || []
);
const monitor = ref(null);
const rig = ref(null);
const ntfyToken = ref('');
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const saved = ref(false);
const testSent = ref(false);
const errorMessage = ref('');
let statusTimer = null;

function messageFrom(error) {
  return error?.response?.data?.detail || error?.message || String(error);
}

async function updateMonitor() {
  monitor.value = await refreshMonitorStatus();
}

async function resetSsids() {
  await resetRigSsids();
  await updateMonitor();
}

function toggleBackground(value) {
  settingsStore.setSessionNotifications({ background: value });
  // The service applies the change; read the result back shortly after.
  setTimeout(updateMonitor, 1500);
}

async function openBatterySettings() {
  try {
    await SessionMonitor.openBatterySettings();
  } catch (error) {
    errorMessage.value = messageFrom(error);
  }
}

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const settings = await apiPinsService.getPinsNotificationSettings();
    if (!settings || typeof settings.ntfy !== 'object') {
      sessionNotificationState.relayAvailable = false;
      return;
    }
    sessionNotificationState.relayAvailable = true;
    rig.value = settings;
  } catch (error) {
    if (error?.response?.status === 404) {
      sessionNotificationState.relayAvailable = false;
    } else {
      errorMessage.value = t(`${k}.loadError`, { message: messageFrom(error) });
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!rig.value) return;
  saving.value = true;
  saved.value = false;
  errorMessage.value = '';
  try {
    // hasToken is read-only; an empty token field keeps the stored token.
    const ntfy = {
      enabled: rig.value.ntfy.enabled,
      url: rig.value.ntfy.url,
      minSeverity: rig.value.ntfy.minSeverity,
      ...(ntfyToken.value ? { token: ntfyToken.value } : {}),
    };
    rig.value = await apiPinsService.updatePinsNotificationSettings({
      includeSystem: rig.value.includeSystem,
      temperatureThresholdC: rig.value.temperatureThresholdC,
      diskFreeThresholdGb: rig.value.diskFreeThresholdGb,
      ntfy,
    });
    ntfyToken.value = '';
    saved.value = true;
  } catch (error) {
    errorMessage.value = t(`${k}.saveError`, { message: messageFrom(error) });
  } finally {
    saving.value = false;
  }
}

async function sendTest() {
  testing.value = true;
  testSent.value = false;
  errorMessage.value = '';
  try {
    await apiPinsService.sendPinsTestNotification({
      severity: 'warning',
      message: t(`${k}.testMessage`),
      delaySeconds: TEST_DELAY_SECONDS,
    });
    testSent.value = true;
  } catch (error) {
    errorMessage.value = messageFrom(error);
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  void load();
  if (backgroundSupported) {
    void updateMonitor();
    statusTimer = setInterval(updateMonitor, 5000);
  }
});

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
});
</script>
