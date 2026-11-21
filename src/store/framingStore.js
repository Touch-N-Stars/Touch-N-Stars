import { defineStore } from 'pinia';
import apiService from '@/services/apiService';

export const useFramingStore = defineStore('FramingStore', {
  state: () => ({
    framingInfo: [],
    searchQuery: '',
    targetSearchResult: [],
    selectedItem: null,
    RAangle: 0,
    DECangle: 90,
    RAangleString: '',
    DECangleString: '',
    ALTangle: 0,
    AZangle: 0,
    ALTangleString: '',
    AZangleString: '',
    useNinaCache: true,
    fov: 5,
    camWidth: 100,
    camHeight: 100,
    containerSize: 500,
    containerWidth: 500,
    containerHeight: 500,
    rotationAngle: 0,
    // The target of the last slew from the app ({ name, ra, dec, atMs }), so a new plan target
    // can start with what the mount was just sent to instead of 00:00:00 / +00°.
    lastTarget: null,
    // How the last slew ended ({ ok, centered, name, atMs }), for "target centered" feedback.
    lastSlewResult: null,
    // Sky position angle of the last plate solve and the timestamp of the log
    // line it came from. rotationAngle stays the target value (the one sent to
    // the hardware); these two are the measured value. Fed by logStore.
    solvedRotationAngle: null,
    solvedRotationTime: null,
    framingReloadKey: 0,
    cameraX: 0, // Kamera-Position X (absolut in Pixeln)
    cameraY: 0, // Kamera-Position Y (absolut in Pixeln)
    cameraRelativeX: 0.5, // Kamera-Position relativ zum Container (0-1)
    cameraRelativeY: 0.5, // Kamera-Position relativ zum Container (0-1)
    initialFovSet: false, // Flag um zu verhindern, dass FOV mehrfach angepasst wird
    isSlewing: false,
    isSlewingAndCentering: false,
    isRotating: false,
    width: 200,
    height: 200,
    slewIsStopt: false,
    isMosaicMode: false,
    mosaicCols: 2,
    mosaicRows: 2,
    mosaicOverlap: 10,
    mosaicPreserveAlignment: true,
    // Sky-Koordinaten der einzelnen Mosaik-Panels, berechnet aus den tatsächlich
    // gerenderten Pixelpositionen (inkl. Rotation + Drag). Quelle der Wahrheit
    // beim Speichern als Favorit, damit gespeicherte Panels exakt dem Overlay
    // entsprechen. Format: [{ label, ra, dec, rotation }]
    mosaicPanelCoords: [],
  }),
  getters: {
    // Single definition of "a solve has arrived", so the framing overlay and
    // the rotator page can never disagree about it.
    hasSolvedRotation: (state) =>
      typeof state.solvedRotationAngle === 'number' && Number.isFinite(state.solvedRotationAngle),
  },
  actions: {
    // "Last value wins": a new solve overwrites the target angle too, so the
    // frame shows reality. A solve that was already applied is recognised by
    // its timestamp and never applied a second time.
    applySolvedRotation(angle, timestamp) {
      if (typeof angle !== 'number' || !Number.isFinite(angle)) return false;
      const time = new Date(timestamp).getTime();
      if (!Number.isFinite(time)) return false;
      const knownTime = this.solvedRotationTime
        ? new Date(this.solvedRotationTime).getTime()
        : null;
      if (knownTime !== null && time <= knownTime) return false;

      this.solvedRotationAngle = angle;
      this.solvedRotationTime = timestamp;
      this.rotationAngle = angle;
      return true;
    },

    resetSolvedRotation() {
      this.solvedRotationAngle = null;
      this.solvedRotationTime = null;
    },

    async slew(RAangle, DECangle) {
      this.slewIsStopt = false;
      console.log('SlewAndCenter', RAangle, DECangle);
      this.isSlewing = true;
      try {
        const response = await apiService.slewAndCenter(RAangle, DECangle, false);
        console.log('SlewAndCenter', response);
        if (!response.Success) return;
      } catch (error) {
        console.error('SlewAndCenter Error', error);
      } finally {
        this.isSlewing = false;
      }
    },
    async slewAndCenter(RAangle, DECangle) {
      console.log('SlewAndCenter', RAangle, DECangle);
      this.isSlewingAndCentering = true;
      try {
        await apiService.slewAndCenter(RAangle, DECangle, true);
      } catch (error) {
        console.error('SlewAndCenter Error', error);
      } finally {
        this.isSlewingAndCentering = false;
      }
    },
    // Resolves to the backend's answer (null on a request error). The request waits for the
    // result, so Success says whether the slew - and the centering, if asked for - worked.
    async slewAndCenterRotate(RAangle, DECangle, center, rotate, name = '') {
      this.slewIsStopt = false;
      console.log('SlewAndCenterRotate', RAangle, DECangle);
      this.isSlewingAndCentering = true;
      this.lastTarget = { name: name || '', ra: RAangle, dec: DECangle, atMs: Date.now() };
      let response = null;
      try {
        response = await apiService.slewAndCenter(
          RAangle,
          DECangle,
          center,
          rotate,
          this.rotationAngle
        );
      } catch (error) {
        console.error('SlewAndCenter Error', error);
      } finally {
        this.isSlewingAndCentering = false;
      }
      this.lastSlewResult = {
        ok: response?.Success === true,
        centered: Boolean(center),
        name: name || '',
        atMs: Date.now(),
      };
      return response;
    },
    async slewStop() {
      console.log('slewStop');
      this.slewIsStopt = true;
      try {
        const response = await apiService.slewStop();
        console.log('slewStop', response);
      } catch (error) {
        console.error('SlewAndCenter Error', error);
      } finally {
        this.isSlewing = false;
        this.isSlewingAndCentering = false;
        this.isRotating = false;
        this.slewIsStopt = false;
      }
    },
    async cameraRotate() {
      console.log('cameraRotate', this.rotationAngle);
      this.isRotating = true;
      try {
        await apiService.framingRotate(this.rotationAngle);
      } catch (error) {
        console.error('cameraRotate Error', error);
      } finally {
        this.isRotating = false;
      }
    },
  },
});
