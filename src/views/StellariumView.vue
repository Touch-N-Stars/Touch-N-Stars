<template>
  <div class="stellarium-container" :class="containerClasses">
    <!-- Canvas für Stellarium -->
    <canvas ref="stelCanvas" class="stellarium-canvas"></canvas>

    <!-- Button für das Suchfeld (Lupe) -->
    <button
      @click="toggleSearch"
      :class="searchButtonClasses"
      class="absolute p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md"
    >
      <MagnifyingGlassIcon class="w-6 h-6 text-white" />
    </button>

    <!-- Mount Position Component -->
    <stellariumMount
      v-if="stellariumStore.stel && store.mountInfo.Connected"
      ref="mountComponent"
      :canvasRef="stelCanvas"
      :isSearchVisible="isSearchVisible"
    />

    <!-- Camera FOV Frame Overlay -->
    <StellariumFovFrame
      v-if="
        stellariumStore.stel &&
        store.cameraInfo.Connected &&
        store.profileInfo?.TelescopeSettings?.FocalLength
      "
    />

    <!-- Camera FOV Rotation Control + View-Center Actions -->
    <StellariumFovRotation
      v-if="
        stellariumStore.stel &&
        store.cameraInfo.Connected &&
        store.profileInfo?.TelescopeSettings?.FocalLength
      "
    />

    <!-- Overlay für das Suchfeld -->
    <div
      v-if="isSearchVisible"
      :class="searchModalClasses"
      class="absolute bg-black bg-opacity-80 p-4 rounded-lg shadow-lg text-white w-80"
      style="z-index: 100"
    >
      <steallriumSearch ref="searchComponent" />
    </div>

    <!-- Overlay für das ausgewählte Objekt -->
    <SelectedObject
      v-if="selectedObject"
      :selectedObject="selectedObject"
      :selectedObjectRa="selectedObjectRa"
      :selectedObjectDec="selectedObjectDec"
      :selectedObjectRaDeg="selectedObjectRaDeg"
      :selectedObjectDecDeg="selectedObjectDecDeg"
      @setFramingCoordinates="setFramingCoordinates"
    />
    <div
      :class="controlsClasses"
      class="fixed flex gap-2 bg-black bg-opacity-90 p-2 rounded-full stellarium-controls"
      style="bottom: calc(env(safe-area-inset-bottom, 0px) + 48px)"
    >
      <stellariumCredits />
      <stellariumSettings />

      <!-- Refresh Button (iOS only) -->
      <button
        v-if="Capacitor.getPlatform() === 'ios'"
        @click="refreshStellarium"
        class="p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md z-10"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-7 h-7 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      <!-- Clock -->
      <stellariumClock v-if="stellariumStore.stel" />
    </div>

    <!-- View Direction Display -->
    <StellariumViewDirection v-if="stellariumStore.stel" />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick, computed } from 'vue';
import { useOrientation } from '@/composables/useOrientation';
import { degreesToHMS, degreesToDMS, rad2deg } from '@/utils/utils';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useStellariumStore } from '@/store/stellariumStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'vue-router';
import steallriumSearch from '@/components/stellarium/steallriumSearch.vue';
import stellariumMount from '@/components/stellarium/stellariumMount.vue';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import stellariumCredits from '@/components/stellarium/stellariumCredits.vue';
import SelectedObject from '@/components/stellarium/SelectedObject.vue';
import stellariumSettings from '@/components/stellarium/stellariumSettings.vue';
import stellariumClock from '@/components/stellarium/stellariumClock.vue';
import StellariumViewDirection from '@/components/stellarium/StellariumViewDirection.vue';
import StellariumFovFrame from '@/components/stellarium/StellariumFovFrame.vue';
import StellariumFovRotation from '@/components/stellarium/StellariumFovRotation.vue';
import { timeSync } from '@/utils/timeSync';
import { utcToMJD } from '@/utils/utils';

const store = apiStore();
const framingStore = useFramingStore();
const stellariumStore = useStellariumStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const stelCanvas = ref(null);
const selectedObject = ref(null);
const selectedObjectRa = ref(null);
const selectedObjectDec = ref(null);
const selectedObjectRaDeg = ref(null);
const selectedObjectDecDeg = ref(null);
const wasmPath = '/stellarium-js/stellarium-web-engine.wasm';
const isSearchVisible = ref(false);
const searchComponent = ref(null);
const mountComponent = ref(null);

const { isLandscape } = useOrientation();

const containerClasses = computed(() => ({
  'stellarium-portrait': !isLandscape.value,
  'stellarium-landscape': isLandscape.value,
}));

// Controls positioning classes
const controlsClasses = computed(() => ({
  'left-2': !isLandscape.value,
  'left-2': isLandscape.value,
}));

// Search button positioning classes
const searchButtonClasses = computed(() => ({
  'top-24 right-3': !isLandscape.value,
  'top-3 right-6': isLandscape.value,
}));

// Search modal positioning classes
const searchModalClasses = computed(() => ({
  'top-28 left-1/2 transform -translate-x-1/2': !isLandscape.value,
  'top-16 right-4': isLandscape.value,
}));

// Funktion zum Ein-/Ausblenden des Suchfeldes
function toggleSearch(event) {
  // Prevent default behavior if event is provided
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Platform detection for iOS-specific handling using Capacitor
  const isIOS = Capacitor.getPlatform() === 'ios';

  // For iOS, first clear any existing selection to avoid UI conflicts
  if (isIOS && selectedObject.value) {
    selectedObject.value = null;
  }

  // Use a small delay on iOS to prevent layout issues
  setTimeout(
    () => {
      isSearchVisible.value = !isSearchVisible.value;

      if (isSearchVisible.value) {
        selectedObject.value = null;

        if (isIOS) {
          // For iOS, add extra delay to ensure UI is ready
          setTimeout(() => {
            searchComponent.value?.focusSearchInput();
          }, 100);
        } else {
          nextTick(() => {
            searchComponent.value?.focusSearchInput();
          });
        }
      }
    },
    isIOS ? 50 : 0
  );
}

// Framing-Koordinaten
function setFramingCoordinates(data) {
  framingStore.RAangleString = data?.raString || selectedObjectRa.value;
  framingStore.DECangleString = data?.decString || selectedObjectDec.value;
  framingStore.RAangle = data?.ra || selectedObjectRaDeg.value;
  framingStore.DECangle = data?.dec || selectedObjectDecDeg.value;
  framingStore.selectedItem = {
    Name: data?.name || selectedObject.value?.[0] || '',
    RA: data?.ra || selectedObjectRaDeg.value,
    Dec: data?.dec || selectedObjectDecDeg.value,
  };

  console.log('Set Framing Coordinates');
  store.mount.currentTab = 'showSlew';
  console.log('store.mount.currentTab', store.mount.currentTab);
  router.push('/mount');
}

// Refresh Stellarium function
function refreshStellarium() {
  console.log('Manually refreshing Stellarium...');
  // Emit event to parent to trigger re-render via landscapeSwitch
  const event = new CustomEvent('refresh-stellarium');
  window.dispatchEvent(event);
}

watch(
  () => stellariumStore.search.DECangleString,
  (newValue) => {
    console.log('selectedObject:', newValue);
    stellariumStore.search.DECangleString = '';
  }
);

onMounted(async () => {
  //NINA vorbereiten
  await store.fetchProfilInfos();

  // Schritt 1) Stellarium-Web-Engine-Skript dynamisch laden
  const script = document.createElement('script');
  script.src = '/stellarium-js/stellarium-web-engine.js';
  console.log('Loading Stellarium Web Engine script...');

  script.onload = async () => {
    if (!window.StelWebEngine) {
      console.error('StelWebEngine global object not found!');
      return;
    }

    try {
      const response = await fetch(wasmPath);
      if (!response.ok) {
        throw new Error(`Error loading WASM file: ${response.statusText}`);
      }
      const wasmArrayBuffer = await response.arrayBuffer();
      console.log('WASM file loaded successfully. Size (bytes):', wasmArrayBuffer.byteLength);

      window.StelWebEngine({
        wasmFile: wasmPath,

        canvas: stelCanvas.value,
        async onReady(stel) {
          console.log('Stellarium is ready!');
          stellariumStore.stel = stel;

          // Beobachter-Standort setzen (Koordinaten müssen in Radian sein):
          stel.core.observer.latitude = store.profileInfo.AstrometrySettings.Latitude * stel.D2R;
          stel.core.observer.longitude = store.profileInfo.AstrometrySettings.Longitude * stel.D2R;
          stel.core.observer.elevation = store.profileInfo.AstrometrySettings.Elevation;

          // Ensure timeSync is synced, then set server time
          await timeSync.ensureSync();
          const serverTime = new Date(timeSync.getServerTime());
          const mjd = utcToMJD(serverTime);
          stel.core.observer.utc = mjd;
          console.log('Stellarium initialized with server time:', serverTime.toISOString());

          // Zeitgeschwindigkeit auf 1 setzen
          stel.core.time_speed = 0;

          // Speichere Stellarium für späteren Zugriff
          stellariumStore.stel = stel;

          // Hilfsfunktion zum Auslesen der aktuellen Blickrichtung (RA/Dec)
          function getCurrentViewDirection() {
            const obs = stel.core.observer;

            // Im VIEW-Frame zeigt [0, 0, -1] nach vorne (wo die Kamera hinzeigt)
            // Im VIEW-Frame zeigt [0, 0, 1] nach hinten (hinter die Kamera)
            const viewVec = [0, 0, -1];

            // Konvertiere von VIEW zu CIRS
            const cirsVec = stel.convertFrame(stel.observer, 'VIEW', 'CIRS', viewVec);

            // Konvertiere zu sphärischen Koordinaten (RA/Dec)
            const raDecSpherical = stel.c2s(cirsVec);

            const alt = obs.azalt[0];
            const az = obs.azalt[1];

            return {
              ra: raDecSpherical[0],
              dec: raDecSpherical[1],
              alt,
              az,
            };
          }

          // Hilfsfunktion zum Setzen der Blickrichtung (RA/Dec)
          function setViewDirection(raDeg, decDeg) {
            try {
              // Convert degrees to radians
              const raRad = raDeg * stel.D2R;
              const decRad = decDeg * stel.D2R;

              // Create ICRF vector from RA/Dec
              const icrfVec = stel.s2c(raRad, decRad);

              // Convert from ICRF to CIRS frame
              const cirsVec = stel.convertFrame(stel.observer, 'ICRF', 'CIRS', icrfVec);

              // Create a virtual circle object at the specified position
              const targetCircle = stel.createObj('circle', {
                id: 'framingTarget',
                pos: cirsVec,
                color: [0, 0, 0, 0.1],
                size: [0.05, 0.05],
              });

              // Update the object and select it
              targetCircle.pos = cirsVec;
              targetCircle.update();
              stel.core.selection = targetCircle;
              stel.pointAndLock(targetCircle);

              console.log('Updated Stellarium view to RA:', raDeg, 'Dec:', decDeg);
            } catch (error) {
              console.error('Error setting view direction:', error);
            }
          }

          stellariumStore.getCurrentViewDirection = getCurrentViewDirection;
          stellariumStore.setViewDirection = setViewDirection;

          // Schritt 3) Datenquellen (Kataloge) hinzufügen
          //IP und Port vom Plugin ermitteln
          const protocol = settingsStore.backendProtocol || 'http';
          const host = settingsStore.connection.ip || window.location.hostname;
          const port = settingsStore.connection.port || window.location.port;
          const baseUrl = `${protocol}://${host}:${port}/stellarium-data/`;
          stellariumStore.baseUrl = baseUrl;
          const core = stel.core;

          core.dsos.hints_mag_offset = 4;
          //core.stars.hints_mag_offset = 3;

          //Daten hinzufügen
          core.stars.addDataSource({ url: baseUrl + 'stars' });
          core.skycultures.addDataSource({ url: baseUrl + 'skycultures/western', key: 'western' });
          core.dsos.addDataSource({ url: baseUrl + 'dso' });
          core.dss.addDataSource({ url: baseUrl + 'surveys/dss' });
          //core.landscapes.addDataSource({ url: baseUrl + 'landscapes/guereins', key: 'guereins' });
          //core.landscapes.addDataSource({ url: baseUrl + 'landscapes/gray', key: 'guereins' });
          core.milkyway.addDataSource({ url: baseUrl + 'surveys/milkyway' });
          core.minor_planets.addDataSource({ url: baseUrl + 'mpcorb.dat', key: 'mpc_asteroids' });
          // Planeten mit offiziellen HiPS-Texturen
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/moon', key: 'moon' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/sun', key: 'sun' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/mercury', key: 'mercury' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/venus', key: 'venus' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/mars', key: 'mars' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/jupiter', key: 'jupiter' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/saturn', key: 'saturn' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/uranus', key: 'uranus' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/neptune', key: 'neptune' });

          // Jupiter-Monde
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/io', key: 'io' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/europa', key: 'europa' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/ganymede', key: 'ganymede' });
          core.planets.addDataSource({ url: baseUrl + 'surveys/sso/callisto', key: 'callisto' });

          core.planets.addDataSource({ url: baseUrl + 'surveys/sso', key: 'default' });
          core.comets.addDataSource({ url: baseUrl + 'CometEls.txt', key: 'mpc_comets' });
          // core.satellites.addDataSource({url: baseUrl + 'tle_satellite.jsonl.gz',key: 'jsonl/sat', });

          stellariumStore.updateStellariumCore();

          // Schritt 4) Selektion beobachten
          stel.change((obj, attr) => {
            if (attr === 'selection') {
              const selection = core.selection;
              if (!selection) {
                // Abwahl
                selectedObject.value = null;
                console.log('No selection (deselected).');
                return;
              }
              if (stel.core.selection) {
                isSearchVisible.value = false;
                const selectedDesignations = stel.core.selection.designations();
                selectedObject.value = selectedDesignations;
                console.log('Object designations:', selectedDesignations);
                const info = stel.core.selection;
                //console.log('Object information:', info);

                const raDec = info.getInfo('RADEC');
                console.log(raDec);
                //const cirs = stel.convertFrame(stel.observer, 'ICRF', 'ICRF', raDec);
                const radecCIRS = stel.c2s(raDec);
                console.log('radecCIRS', radecCIRS);
                const ra = stel.anp(radecCIRS[0]); // RA in Radian
                const dec = stel.anpm(radecCIRS[1]); // Dec in Radian

                console.log(ra, dec);

                selectedObjectRa.value = degreesToHMS(rad2deg(ra));
                selectedObjectDec.value = degreesToDMS(rad2deg(dec));
                selectedObjectRaDeg.value = rad2deg(ra);
                selectedObjectDecDeg.value = rad2deg(dec);
              }
            }
          });
        },
      });
    } catch (err) {
      console.error('Error with Fetch or StelWebEngine:', err);
    }
  };
  document.head.appendChild(script);
});
onBeforeUnmount(() => {
  if (stellariumStore.stel) {
    console.log('Destroying Stellarium...');

    // Entferne die Stellarium-Instanz
    stellariumStore.stel = null;

    if (stelCanvas.value) {
      stelCanvas.value.width = 0;
      stelCanvas.value.height = 0;
    }

    console.log('Stellarium successfully terminated.');
  }
});
</script>

<style scoped>
.stellarium-container {
  position: fixed;
  z-index: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Landscape Mode  */
.stellarium-landscape {
  top: 0;
  left: 8rem;
  width: calc(100vw - 8rem);
  height: calc(100dvh - 2rem - env(safe-area-inset-bottom, 0px));
}

@media screen and (orientation: landscape) {
  .stellarium-controls.left-2 {
    left: 9rem !important;
  }
}

.stellarium-portrait {
  top: 0;
  left: 0;
  width: 100vw;
  height: calc(100dvh - 1.5rem - env(safe-area-inset-bottom, 0px));
}

.stellarium-canvas {
  width: 100%;
  height: 100%;
}
</style>
