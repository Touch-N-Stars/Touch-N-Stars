<template>
  <div
    class="flex h-[85vh] w-full flex-col overflow-hidden bg-gray-900 border border-gray-700 rounded-lg relative shadow-xl"
  >
    <!-- Viewer Container (Always rendered, overlays others when connected) -->
    <div ref="viewerRef" class="relative h-full w-full bg-black cursor-crosshair">
      <!-- NoVNC Style Toolbar -->
      <transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="-translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="translate-x-0"
        leave-to-class="-translate-x-full"
      >
        <div
          v-if="isConnected && isToolbarOpen"
          class="absolute left-0 top-0 z-30 flex h-full w-14 flex-col items-center gap-4 border-r border-gray-700 bg-gray-900/95 py-4 backdrop-blur-sm shadow-2xl"
        >
          <!-- Close Toolbar -->
          <button
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            title="Close Menu"
            @click="isToolbarOpen = false"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div class="h-px w-8 bg-gray-700"></div>

          <!-- Fullscreen -->
          <button
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            :class="{ 'text-indigo-400': isFullscreen }"
            :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
            @click="toggleFullscreen"
          >
            <svg
              v-if="!isFullscreen"
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <!-- Pan/Zoom Toggle -->
          <button
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            :class="{ 'text-indigo-400': isNavMode }"
            :title="isNavMode ? 'Switch to Interact Mode' : 'Switch to Pan/Zoom Mode'"
            @click="toggleNavMode"
          >
            <svg
              v-if="!isNavMode"
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
          </button>

          <!-- Touch/Mouse Input Mode Toggle -->
          <button
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            :class="{ 'text-indigo-400': isTouchInputMode }"
            :title="
              isTouchInputMode ? 'Switch to Mouse Pointer Mode' : 'Switch to Touch Input Mode'
            "
            @click="toggleInputMode"
          >
            <svg
              v-if="isTouchInputMode"
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 2a2 2 0 012 2v8h1.5a2.5 2.5 0 012.5 2.5V16a6 6 0 01-12 0v-3a2 2 0 114 0v1"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 3l14 8-6 2-2 6-6-16z"
              />
            </svg>
          </button>

          <!-- Ctrl-Alt-Del -->
          <button
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            title="Send Ctrl+Alt+Del"
            @click="sendCtrlAltDel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </button>

          <!-- On-Screen Keyboard -->
          <button
            v-if="!isMobileClient"
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            :class="{ 'text-indigo-400': isKeyboardOpen }"
            :title="isKeyboardOpen ? 'Hide Keyboard' : 'Show Keyboard'"
            @click="isKeyboardOpen = !isKeyboardOpen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 7h18a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1zm2 3h1m2 0h1m2 0h1m2 0h1m2 0h1M5 14h6m2 0h6"
              />
            </svg>
          </button>

          <!-- Native Keyboard (mobile only) -->
          <button
            v-if="isMobileClient"
            class="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            :class="{ 'text-indigo-400': isNativeKeyboardOpen }"
            :title="isNativeKeyboardOpen ? 'Hide Native Keyboard' : 'Open Native Keyboard'"
            @click="isNativeKeyboardOpen ? (isNativeKeyboardOpen = false) : openNativeKeyboard()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zm1 4h6M9 17h6"
              />
            </svg>
          </button>

          <div class="mt-auto flex flex-col gap-4">
            <div class="h-px w-8 bg-gray-700"></div>
            <!-- Disconnect -->
            <button
              class="rounded p-2 text-red-400 hover:bg-gray-800 hover:text-red-300"
              title="Disconnect"
              @click="disconnect"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </transition>

      <!-- Toolbar Toggle Handle -->
      <button
        v-if="isConnected && !isToolbarOpen"
        class="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-lg bg-gray-800/80 p-2 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-indigo-600/90 hover:pr-3"
        title="Open Menu"
        @click="isToolbarOpen = true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <OnScreenKeyboard
        v-if="isConnected && isKeyboardOpen"
        :native-keyboard-open="isNativeKeyboardOpen"
        @send-keysym="sendKeysym"
        @send-printable="sendPrintableCharacter"
      />

      <!-- Native Mobile Keyboard Dock -->
      <div
        v-if="isConnected && isNativeKeyboardOpen"
        class="absolute bottom-2 left-2 right-2 z-50 rounded-lg border border-gray-700 bg-gray-900/95 p-2 shadow-2xl backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <input
            ref="nativeKeyboardInputRef"
            v-model="nativeKeyboardValue"
            type="text"
            inputmode="text"
            autocapitalize="none"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="enter"
            class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            placeholder="Native keyboard input"
            @keydown="handleNativeKeyboardKeydown"
            @input="handleNativeKeyboardInput"
          />
          <button
            class="rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
            @click="focusNativeKeyboard"
          >
            Focus
          </button>
          <button
            class="rounded bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
            @click="isNativeKeyboardOpen = false"
          >
            Hide
          </button>
        </div>
      </div>
    </div>

    <!-- Connection Overlay -->
    <div
      v-if="!isConnected"
      class="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm p-2 overflow-hidden"
    >
      <div
        class="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-2xl transition-all"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-bold text-white uppercase tracking-wider">VNC Connect</h2>
          <div v-if="statusMessage" class="text-xs text-gray-400">{{ statusMessage }}</div>
        </div>

        <div class="flex gap-2 mb-3">
          <div class="grow relative">
            <input
              v-model.trim="host"
              type="text"
              class="w-full rounded bg-gray-900/50 px-3 py-2 text-sm text-white placeholder-gray-600 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Host / IP"
              :disabled="isConnecting"
            />
          </div>

          <div class="w-20 shrink-0">
            <input
              v-model.trim="port"
              type="number"
              class="w-full rounded bg-gray-900/50 px-3 py-2 text-sm text-white placeholder-gray-600 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Port"
              :disabled="isConnecting"
            />
          </div>
        </div>

        <!-- PINS' wayvnc requires the Pi's desktop login since wayvnc 0.10.2-1+rpt2 -->
        <div class="flex gap-2 mb-3">
          <input
            v-model.trim="username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            class="tns-input grow"
            :placeholder="$t('plugins.vncRemote.username')"
            :disabled="isConnecting"
          />
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="tns-input grow"
            :placeholder="$t('plugins.vncRemote.password')"
            :disabled="isConnecting"
            @keydown.enter="connect"
          />
        </div>

        <label class="tns-label mb-3 flex items-center gap-2">
          <input v-model="rememberPassword" type="checkbox" :disabled="isConnecting" />
          {{ $t('plugins.vncRemote.rememberPassword') }}
        </label>

        <div
          v-if="settingsStore.showDebugConsole"
          class="mb-3 rounded bg-yellow-900/30 p-2 text-xs text-yellow-200 border border-yellow-700/50"
        >
          ⚠ {{ $t('plugins.vncRemote.debugModeWarning') }}
        </div>

        <div
          v-if="errorMessage"
          class="mb-3 rounded bg-red-900/20 p-2 text-xs text-red-200 border border-red-900/30 break-words"
        >
          {{ errorMessage }}
        </div>

        <button
          class="w-full rounded bg-indigo-600 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
          :disabled="isConnecting || !canConnect"
          @click="connect"
        >
          {{ isConnecting ? 'Connecting...' : 'Connect' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { useSettingsStore } from '@/store/settingsStore';
import Panzoom from '@panzoom/panzoom';
import OnScreenKeyboard from '../components/OnScreenKeyboard.vue';
import { useI18n } from 'vue-i18n';

const settingsStore = useSettingsStore();
const { t } = useI18n();

const CREDENTIALS_STORAGE_KEY = 'vncRemote.credentials';

const host = ref('');
const port = ref('6080');
const username = ref('pi');
const password = ref('');
const rememberPassword = ref(false);
// Credentials are sent at most once per connection attempt so a wrong
// password ends in a security failure instead of a resend loop.
let credentialsSent = false;

const loadStoredCredentials = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CREDENTIALS_STORAGE_KEY) || 'null');
    if (!stored) return;
    if (typeof stored.username === 'string' && stored.username) username.value = stored.username;
    if (typeof stored.password === 'string' && stored.password) {
      password.value = stored.password;
      rememberPassword.value = true;
    }
  } catch {
    // Storage can be unavailable (private mode); fall back to the defaults.
  }
};

const storeCredentials = () => {
  try {
    localStorage.setItem(
      CREDENTIALS_STORAGE_KEY,
      JSON.stringify({
        username: username.value,
        password: rememberPassword.value ? password.value : '',
      })
    );
  } catch {
    // Ignore storage failures; the user can still type the password.
  }
};

const isConnecting = ref(false);
const isConnected = ref(false);
const statusMessage = ref('Not connected');
const errorMessage = ref('');

const viewerRef = ref(null);
// shallowRef: noVNC's RFB must not be wrapped in a deep reactive proxy.
const rfbInstance = shallowRef(null);
const isFullscreen = ref(false);
const isToolbarOpen = ref(false);
const isNavMode = ref(false);
const panzoomInstance = ref(null);
const isTouchInputMode = ref(false);
const isKeyboardOpen = ref(false);
const isNativeKeyboardOpen = ref(false);
const nativeKeyboardInputRef = ref(null);
const nativeKeyboardValue = ref('');
const isMobileClient = ref(false);

const updateFullscreenState = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const detectMobileClient = () => {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') {
    isMobileClient.value = true;
    isTouchInputMode.value = true;
    return;
  }

  const hasCoarsePointer =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  isMobileClient.value = hasCoarsePointer || mobileUa;
  isTouchInputMode.value = isMobileClient.value;
};

const updateViewerCursor = () => {
  if (!viewerRef.value) return;
  if (isNavMode.value) {
    viewerRef.value.style.cursor = 'grab';
    return;
  }
  viewerRef.value.style.cursor = isTouchInputMode.value ? 'auto' : 'crosshair';
};

const applyInputMode = () => {
  if (!rfbInstance.value) {
    updateViewerCursor();
    return;
  }

  // In touch mode, dragging pans the viewport and taps become clicks.
  rfbInstance.value.dragViewport = isTouchInputMode.value;
  rfbInstance.value.showDotCursor = !isTouchInputMode.value;
  updateViewerCursor();
};

const sendCtrlAltDel = () => {
  if (rfbInstance.value) {
    rfbInstance.value.sendCtrlAltDel();
  }
};

const sendKeysym = (keysym) => {
  if (!rfbInstance.value || !Number.isInteger(keysym)) return;
  rfbInstance.value.sendKey(keysym);
};

const sendPrintableCharacter = (character) => {
  if (!rfbInstance.value || !character) return;
  const keysym = character.codePointAt(0);
  if (!Number.isInteger(keysym)) return;
  rfbInstance.value.sendKey(keysym);
};

const focusNativeKeyboard = async () => {
  await nextTick();
  nativeKeyboardInputRef.value?.focus();
};

const toggleInputMode = () => {
  isTouchInputMode.value = !isTouchInputMode.value;
  applyInputMode();
};

const openNativeKeyboard = async () => {
  isNativeKeyboardOpen.value = true;
  await focusNativeKeyboard();
};

const handleNativeKeyboardKeydown = (event) => {
  if (!rfbInstance.value) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    sendKeysym(0xff0d);
    nativeKeyboardValue.value = '';
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    sendKeysym(0xff08);
    nativeKeyboardValue.value = '';
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    sendKeysym(0xff09);
  }
};

const handleNativeKeyboardInput = (event) => {
  const value = event?.target?.value || '';
  if (!value) return;

  for (const character of value) {
    sendPrintableCharacter(character);
  }

  nativeKeyboardValue.value = '';
};

const enablePanzoom = () => {
  if (rfbInstance.value) {
    rfbInstance.value.viewOnly = true;
  }

  if (!panzoomInstance.value && viewerRef.value) {
    const canvas = viewerRef.value.querySelector('canvas');
    if (canvas) {
      panzoomInstance.value = Panzoom(canvas, {
        maxScale: 10,
        minScale: 1,
        contain: 'outside',
        startScale: 1,
      });
    }
  }

  if (panzoomInstance.value) {
    panzoomInstance.value.bind();
    updateViewerCursor();
  }
};

const disablePanzoom = () => {
  if (rfbInstance.value) {
    rfbInstance.value.viewOnly = false;
  }

  if (panzoomInstance.value) {
    panzoomInstance.value.unbind();
  }
  updateViewerCursor();
};

const toggleNavMode = () => {
  isNavMode.value = !isNavMode.value;
  if (isNavMode.value) {
    enablePanzoom();
  } else {
    disablePanzoom();
  }
};

const applyAutoHost = () => {
  const candidateHost = settingsStore?.connection?.ip || window?.location?.hostname || 'localhost';
  const trimmed = host.value.trim();

  // Only auto-fill when the field is still empty or on its default.
  if (!trimmed || trimmed === 'localhost' || trimmed === window?.location?.hostname) {
    host.value = candidateHost;
  }
};

onMounted(() => {
  detectMobileClient();
  loadStoredCredentials();
  applyAutoHost();
  document.addEventListener('fullscreenchange', updateFullscreenState);
});

watch(
  () => settingsStore?.connection?.ip,
  () => {
    if (isConnected.value || isConnecting.value) return;
    applyAutoHost();
  }
);

const connectionUrl = computed(() => {
  const trimmedHost = host.value.trim() || 'localhost';
  const trimmedPort = (port.value || '').toString().trim() || '6080';

  // Use a sensible default based on how the UI is hosted
  const scheme = window?.location?.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${trimmedHost}:${trimmedPort}`;
});

const canConnect = computed(
  () => Boolean(host.value.trim()) && Boolean(port.value) && !settingsStore.showDebugConsole
);

const toggleFullscreen = () => {
  if (!viewerRef.value) return;

  if (!document.fullscreenElement) {
    viewerRef.value.requestFullscreen().catch((err) => {
      console.warn(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
};

const detachRfb = () => {
  if (panzoomInstance.value) {
    panzoomInstance.value.destroy();
    panzoomInstance.value = null;
  }
  isNavMode.value = false;

  if (!rfbInstance.value) return;

  rfbInstance.value.removeEventListener('connect', handleConnect);
  rfbInstance.value.removeEventListener('disconnect', handleDisconnect);
  rfbInstance.value.removeEventListener('credentialsrequired', handleCredentialsRequired);
  rfbInstance.value.removeEventListener('securityfailure', handleSecurityFailure);

  try {
    rfbInstance.value.disconnect();
  } catch (error) {
    console.warn('Failed to close VNC session', error);
  }

  rfbInstance.value = null;
};

function handleConnect() {
  isConnected.value = true;
  statusMessage.value = 'Connected';
  if (credentialsSent) storeCredentials();
}

function handleDisconnect(event) {
  isConnected.value = false;
  const reason = event?.detail?.reason || 'Disconnected';
  statusMessage.value = reason;
}

function handleSecurityFailure(event) {
  isConnected.value = false;
  if (credentialsSent) {
    errorMessage.value = t('plugins.vncRemote.authFailed');
  } else {
    errorMessage.value = event?.detail?.status
      ? `Security error (${event.detail.status})`
      : 'Security error';
  }
  statusMessage.value = 'Connection failed';
}

function handleCredentialsRequired(event) {
  const types = event?.detail?.types || ['password'];
  const missing =
    (types.includes('username') && !username.value) ||
    (types.includes('password') && !password.value);

  if (credentialsSent || missing) {
    isConnected.value = false;
    errorMessage.value = t('plugins.vncRemote.credentialsRequired');
    statusMessage.value = 'Awaiting credentials';
    detachRfb();
    return;
  }

  credentialsSent = true;
  statusMessage.value = 'Authenticating...';
  rfbInstance.value?.sendCredentials({ username: username.value, password: password.value });
}

const connect = async () => {
  if (isConnecting.value || !canConnect.value) return;

  errorMessage.value = '';
  statusMessage.value = 'Connecting...';
  isConnecting.value = true;

  try {
    if (!viewerRef.value) {
      throw new Error('Viewer is not ready yet');
    }

    detachRfb();
    credentialsSent = false;
    if (!rememberPassword.value) storeCredentials();

    let rfbModule;
    try {
      // Some bundlers resolve the extensionless path more reliably.
      rfbModule = await import('@novnc/novnc/lib/rfb');
    } catch {
      rfbModule = await import('@novnc/novnc/lib/rfb.js');
    }
    const { default: RFB } = rfbModule;

    // Over plain HTTP there is no crypto.subtle; give noVNC a JS AES so the
    // wayvnc login (Apple DH) works there too.
    const { installInsecureContextCrypto } = await import('../utils/novncInsecureContextCrypto.js');
    installInsecureContextCrypto();

    const rfb = new RFB(viewerRef.value, connectionUrl.value, {
      shared: true,
    });

    // Let noVNC handle scaling so pointer coordinates match the image.
    // CSS-stretching the canvas breaks click/drag mapping.
    rfb.scaleViewport = true;
    rfb.clipViewport = true;
    rfb.resizeSession = false;

    rfb.addEventListener('connect', handleConnect);
    rfb.addEventListener('disconnect', handleDisconnect);
    rfb.addEventListener('credentialsrequired', handleCredentialsRequired);
    rfb.addEventListener('securityfailure', handleSecurityFailure);

    rfbInstance.value = rfb;
    applyInputMode();
  } catch (error) {
    statusMessage.value = 'Failed to connect';
    errorMessage.value = error?.message || String(error);
    isConnected.value = false;
  } finally {
    isConnecting.value = false;
  }
};

const disconnect = () => {
  detachRfb();
  isConnected.value = false;
  statusMessage.value = 'Disconnected';
  isKeyboardOpen.value = false;
  isNativeKeyboardOpen.value = false;
  nativeKeyboardValue.value = '';
};

onBeforeUnmount(() => {
  detachRfb();
  document.removeEventListener('fullscreenchange', updateFullscreenState);
});
</script>
