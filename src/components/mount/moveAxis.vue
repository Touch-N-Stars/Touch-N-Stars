<template>
  <div class="relative">
    <!-- Own positioning context for the parked overlay, so it covers the direction pad
         only and leaves the slew rate control below it usable. -->
    <div class="relative">
      <div
        class="grid grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-4 place-items-center w-48 sm:w-64 mx-auto move-axis-grid"
      >
        <!-- Obere Reihe (Nord) -->
        <div></div>
        <button
          :disabled="store.mountIsParked"
          @mousedown="sendCommand('north')"
          @mouseup="sendStop"
          @mouseleave="sendStop"
          @touchstart.prevent="handleTouchStart('north', $event)"
          @touchend.prevent="handleTouchEnd"
          @touchcancel.prevent="handleTouchEnd"
          @blur="sendStop"
          @contextmenu.prevent
          class="btn"
          :class="mountStore.lastDirection === 'north' ? 'glow-green' : ''"
        >
          <ArrowUpCircleIcon
            :class="mountStore.lastDirection === 'north' ? 'text-green-500' : 'text-gray-400'"
            class="w-8 h-8 sm:w-12 sm:h-12 move-axis-icon"
          />
        </button>
        <div></div>

        <!-- Mittlere Reihe (West, Stop, Ost) -->
        <button
          :disabled="store.mountIsParked"
          @mousedown="sendCommand('west')"
          @mouseup="sendStop"
          @mouseleave="sendStop"
          @touchstart.prevent="handleTouchStart('west', $event)"
          @touchend.prevent="handleTouchEnd"
          @touchcancel.prevent="handleTouchEnd"
          @blur="sendStop"
          @contextmenu.prevent
          class="btn"
          :class="mountStore.lastDirection === 'west' ? 'glow-green' : ''"
        >
          <ArrowLeftCircleIcon
            :class="mountStore.lastDirection === 'west' ? 'text-green-500' : 'text-gray-400'"
            class="w-8 h-8 sm:w-12 sm:h-12 move-axis-icon"
          />
        </button>
        <!-- Deliberately not disabled while parked: an emergency stop must always get through. -->
        <button @click="sendStop" class="btn btn-stop" :disabled="!mountStore.wsIsConnected">
          <StopCircleIcon
            class="w-8 h-8 sm:w-12 sm:h-12 move-axis-icon"
            :class="mountStore.lastDirection === '' ? 'text-red-500' : 'text-gray-400'"
          />
        </button>
        <button
          :disabled="store.mountIsParked"
          @mousedown="sendCommand('east')"
          @mouseup="sendStop"
          @mouseleave="sendStop"
          @touchstart.prevent="handleTouchStart('east', $event)"
          @touchend.prevent="handleTouchEnd"
          @touchcancel.prevent="handleTouchEnd"
          @blur="sendStop"
          @contextmenu.prevent
          class="btn"
          :class="mountStore.lastDirection === 'east' ? 'glow-green' : ''"
        >
          <ArrowRightCircleIcon
            :class="mountStore.lastDirection === 'east' ? 'text-green-500' : 'text-gray-400'"
            class="w-8 h-8 sm:w-12 sm:h-12 move-axis-icon"
          />
        </button>

        <!-- Untere Reihe (Süd) -->
        <div></div>
        <button
          :disabled="store.mountIsParked"
          @mousedown="sendCommand('south')"
          @mouseup="sendStop"
          @mouseleave="sendStop"
          @touchstart.prevent="handleTouchStart('south', $event)"
          @touchend.prevent="handleTouchEnd"
          @touchcancel.prevent="handleTouchEnd"
          @blur="sendStop"
          @contextmenu.prevent
          class="btn"
          :class="mountStore.lastDirection === 'south' ? 'glow-green' : ''"
        >
          <ArrowDownCircleIcon
            :class="mountStore.lastDirection === 'south' ? 'text-green-500' : 'text-gray-400'"
            class="w-8 h-8 sm:w-12 sm:h-12 move-axis-icon"
          />
        </button>
      </div>
      <!-- Parked Overlay. Only while the socket is up, so it never competes with the
           connecting overlay below, which keeps its z-50 precedence on the outer container. -->
      <div
        v-if="store.mountIsParked && mountStore.wsIsConnected"
        class="absolute inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center rounded-xl z-40 pointer-events-none"
      >
        <!-- The backdrop stays click-through so the always-enabled stop button below it
             keeps working; the direction buttons underneath are disabled anyway. -->
        <div class="flex flex-col items-center gap-2 text-center px-3 pointer-events-auto">
          <LockClosedIcon class="w-7 h-7 text-status-warn" />
          <p class="text-sm text-content">{{ $t('components.mount.control.parkedShort') }}</p>
          <p class="text-xs text-content-faint">
            {{ $t('components.mount.control.parkedHint') }}
          </p>
          <!-- w-auto! overrides the w-full from the tns-btn base, which would stretch the
               button across the whole pad. -->
          <ButtonUnpark class="w-auto! px-4! py-1.5! text-xs! mt-1" />
        </div>
      </div>
    </div>
    <div
      class="flex flex-col bg-gray-900/80 w-full border border-gray-300 p-1 sm:p-2 mt-1 rounded-xl gap-1"
    >
      <SetSlewRate v-if="!store.isPINS" />
      <setSlewRatePins v-else />
    </div>
    <!-- Loading Overlay -->
    <div
      v-if="!mountStore.wsIsConnected"
      class="absolute inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center rounded-xl z-50"
    >
      <div class="flex flex-col items-center space-y-3">
        <!-- Spinner -->
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        <p class="text-gray-300 text-sm">Connecting...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import websocketMountControl from '@/services/websocketMountControl';
import { useMountStore } from '@/store/mountStore';
import { useSettingsStore } from '@/store/settingsStore';
import SetSlewRate from './settings/setSlewRate.vue';
import setSlewRatePins from './setSlewRatePins.vue';
import ButtonUnpark from '@/components/mount/ButtonUnpark.vue';
import {
  ArrowRightCircleIcon,
  ArrowLeftCircleIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  StopCircleIcon,
  LockClosedIcon,
} from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';

const mountStore = useMountStore();
const store = apiStore();
const settingsStore = useSettingsStore();
let commandInterval = null; // Speichert das Intervall
let failsafeTimeout = null; // Sicherheits-Timeout

const sendCommand = (direction) => {
  console.log('sendCommand called for:', direction);

  if (!mountStore.wsIsConnected) {
    console.error('WebSocket is not connected.');
    return;
  }

  if (store.mountIsParked) {
    console.warn('Mount is parked, ignoring move command.');
    return;
  }

  // Stop a still-running interval before starting a new one
  if (commandInterval) {
    clearInterval(commandInterval);
    commandInterval = null;
    console.log('Previous command interval cleared before starting new one');
  }

  mountStore.lastDirection = direction;

  const sendMoveMessage = () => {
    if (!mountStore.wsIsConnected) {
      console.error('WebSocket lost during command.');
      clearInterval(commandInterval);
      commandInterval = null;
      return;
    }

    // A sequence can park the mount while a button is still held down. Without this the
    // repeat would keep firing into the void until the 30s failsafe.
    if (store.mountIsParked) {
      console.warn('Mount parked during command, stopping.');
      sendStop();
      return;
    }

    // PINS sets the slew rate separately via the capability REST endpoint, so movement is
    // direction only. Upstream NINA still carries the rate on each message.
    const message = store.isPINS
      ? { direction: direction }
      : { direction: direction, rate: settingsStore.mount.slewRate };

    websocketMountControl.sendMessage(JSON.stringify(message));
    console.log(`WS command sent:`, message);
  };

  sendMoveMessage(); // send the command immediately
  commandInterval = setInterval(sendMoveMessage, 800);

  // Failsafe: stop automatically after 30 seconds
  if (failsafeTimeout) {
    clearTimeout(failsafeTimeout);
  }
  failsafeTimeout = setTimeout(() => {
    console.log('FAILSAFE: automatic stop after 30s');
    sendStop();
  }, 30000);
};

// Spezielle Touch-Handler für Android
const handleTouchStart = (direction, event) => {
  console.log('handleTouchStart:', direction);

  // Verhindere alle Standard-Browser-Aktionen
  event.preventDefault();
  event.stopPropagation();

  // Entferne jegliche Text-Selektion
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }

  // Starte Bewegung
  sendCommand(direction);
};

const handleTouchEnd = (event) => {
  console.log('handleTouchEnd');

  // Verhindere alle Standard-Browser-Aktionen
  event.preventDefault();
  event.stopPropagation();

  // Stoppe Bewegung
  sendStop();
};

const sendStop = () => {
  console.log('sendStop called');

  if (!mountStore.lastDirection) {
    console.log('No previous command to stop.');
    return;
  }

  // Stoppe das Intervall auf jeden Fall
  if (commandInterval) {
    clearInterval(commandInterval);
    commandInterval = null;
    console.log('Command interval cleared');
  }

  // Stoppe auch das Failsafe-Timeout
  if (failsafeTimeout) {
    clearTimeout(failsafeTimeout);
    failsafeTimeout = null;
    console.log('Failsafe timeout cleared');
  }

  if (!mountStore.wsIsConnected) {
    console.error('WebSocket is not connected for stop.');
    // Reset lastDirection anyway
    mountStore.lastDirection = '';
    return;
  }

  const message = store.isPINS
    ? { direction: 'stop' }
    : { direction: mountStore.lastDirection, rate: 0 };

  websocketMountControl.sendMessage(JSON.stringify(message));
  console.log(`WS stop command sent:`, message);
  mountStore.lastDirection = '';
};

onMounted(() => {
  websocketMountControl.setStatusCallback((status) => {
    console.log('Status updated:', status);
    if (status === 'connected') {
      mountStore.wsIsConnected = true;
    }
  });
  websocketMountControl.connect();

  // Globaler Event-Listener für Sicherheit
  const handleGlobalStop = () => {
    if (mountStore.lastDirection) {
      console.log('Global emergency stop triggered');
      sendStop();
    }
  };

  document.addEventListener('visibilitychange', handleGlobalStop);
  window.addEventListener('blur', handleGlobalStop);
  window.addEventListener('pagehide', handleGlobalStop);
});

onBeforeUnmount(() => {
  // Sicherheits-Stop beim Unmount
  if (mountStore.lastDirection) {
    sendStop();
  }

  // Cleanup
  if (commandInterval) {
    clearInterval(commandInterval);
    commandInterval = null;
  }
  if (failsafeTimeout) {
    clearTimeout(failsafeTimeout);
    failsafeTimeout = null;
  }

  websocketMountControl.setStatusCallback(null);
  websocketMountControl.setMessageCallback(null);
  websocketMountControl.disconnect();
  mountStore.lastDirection = '';
  mountStore.wsIsConnected = false;
});
</script>

<style scoped>
.move-axis-grid {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn {
  border-radius: 1rem;
  background-color: #334155;
  padding: 0.5rem;
  box-shadow: 0 2px 15px black;
  border: 1px solid #0a0a0a;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  min-width: 3rem;
  min-height: 3rem;
}

@media (min-width: 640px) {
  .btn {
    padding: 0.75rem;
    min-width: 4rem;
    min-height: 4rem;
  }
}

/* Landscape-Modus Anpassungen */
@media screen and (orientation: landscape) {
  .move-axis-grid {
    width: 12rem; /* w-48 */
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .move-axis-icon {
    width: 2rem; /* w-8 */
    height: 2rem; /* h-8 */
  }

  .btn {
    padding: 0.375rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
  }
}
.glow-green {
  box-shadow: 0 0 10px #00ff00;
}
.glow-red {
  box-shadow: 0 0 10px rgb(255, 0, 0); /* Roter Schein */
}
</style>
