import { defineStore } from 'pinia';
import { luckyCaptureRequest, luckyCaptureUrl } from '../services/luckycapture';

// Network resources belong to the mounted view, never to the capture session.
let events;
let controller;
let generation = 0;
let sampling = false;
let previewGeneration = 0;
export const useLuckyCaptureStore = defineStore('luckycapture', {
  state: () => ({
    available: false,
    camera: null,
    controls: [],
    capabilities: {},
    settings: {},
    status: {},
    histogram: null,
    previewUrl: '',
    previewRoi: null,
    snapshotPath: '',
    snapshotFallback: null,
    error: '',
    pending: false,
    streamConnected: false,
  }),
  getters: {
    active: (s) =>
      ['STARTING', 'PREVIEWING', 'RECORDING', 'STOPPING', 'FINALIZING'].includes(s.status.state),
  },
  actions: {
    clearPreview() {
      previewGeneration++;
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
      this.histogram = null;
      this.previewRoi = null;
    },
    async changeRoi(roi) {
      if (!this.camera?.connected || !['READY', 'PREVIEWING', 'ERROR'].includes(this.status.state))
        throw new Error('Stop recording before changing ROI');
      const resume = this.status.state === 'PREVIEWING';
      if (resume) await this.command('preview/stop', {});
      this.settings = await this.command('settings', { ...this.settings, roi }, 'PUT');
      this.clearPreview();
      if (resume) await this.command('preview/start', { previewFps: 8 });
    },
    failure(error) {
      if (error?.code === 'ERR_CANCELED') return;
      this.error = error?.response?.data?.message || error?.message || 'Request failed';
    },
    async command(path, data, method = 'POST') {
      this.pending = true;
      this.error = '';
      try {
        const result = await luckyCaptureRequest(path, data, method, controller?.signal);
        if (result?.state) this.status = result;
        if (path === 'preview/start' || path === 'recording/start')
          this.previewRoi = this.settings.roi ? { ...this.settings.roi } : null;
        if (path === 'snapshot') {
          this.snapshotPath = result.outputPath;
          this.snapshotFallback = result.outputDirectoryFallback
            ? { requested: result.requestedOutputDirectory, directory: result.outputDirectory }
            : null;
        }
        return result;
      } catch (error) {
        this.failure(error);
        throw error;
      } finally {
        this.pending = false;
      }
    },
    async open() {
      this.close();
      const current = ++generation;
      controller = new AbortController();
      this.error = '';
      try {
        await luckyCaptureRequest('health', undefined, 'GET', controller.signal);
        if (current !== generation) return;
        this.available = true;
        await this.refreshCamera();
        const [status, settings, capabilities] = await Promise.all(
          ['status', 'settings', 'capabilities'].map((path) =>
            luckyCaptureRequest(path, undefined, 'GET', controller.signal)
          )
        );
        if (current !== generation) return;
        Object.assign(this, { status, settings, capabilities });
        this.previewRoi = settings.roi ? { ...settings.roi } : null;
        events = new EventSource(luckyCaptureUrl('events'));
        events.onopen = () => {
          if (current === generation) this.streamConnected = true;
        };
        events.onerror = () => {
          if (current === generation) this.streamConnected = false;
        };
        let refreshingConnection = false;
        events.onmessage = async (event) => {
          if (current !== generation) return;
          const previous = this.status.previewSequence;
          this.status = JSON.parse(event.data);
          if (this.status.state === 'DISCONNECTED') this.camera = { connected: false };
          else if (
            this.status.state === 'READY' &&
            !this.camera?.connected &&
            !refreshingConnection
          ) {
            refreshingConnection = true;
            try {
              await this.refreshCamera();
              const capabilities = await luckyCaptureRequest(
                'capabilities',
                undefined,
                'GET',
                controller?.signal
              );
              if (current === generation) this.capabilities = capabilities;
            } catch (error) {
              if (current === generation) this.failure(error);
            } finally {
              refreshingConnection = false;
            }
          }
          if (current !== generation) return;
          if (previous !== this.status.previewSequence && this.status.previewSequence > 0)
            await this.sample(current);
        };
        if (status.previewSequence > 0) await this.sample(current);
      } catch (error) {
        if (current === generation) {
          this.available = false;
          this.failure(error);
        }
      }
    },
    async refreshCamera() {
      const current = generation;
      const signal = controller?.signal;
      const camera = await luckyCaptureRequest('camera', undefined, 'GET', signal);
      const controls = camera.connected
        ? await luckyCaptureRequest('controls', undefined, 'GET', signal)
        : [];
      if (current !== generation) return;
      this.camera = camera;
      this.controls = controls;
    },
    async sample(current) {
      if (sampling) return;
      sampling = true;
      const preview = previewGeneration;
      try {
        const [histogram, response] = await Promise.all([
          luckyCaptureRequest('histogram', undefined, 'GET', controller.signal),
          fetch(luckyCaptureUrl(`preview?revision=${this.status.previewSequence}`), {
            signal: controller.signal,
          }),
        ]);
        if (!response.ok) return;
        const blob = await response.blob();
        if (current !== generation || preview !== previewGeneration) return;
        const old = this.previewUrl;
        this.previewUrl = URL.createObjectURL(blob);
        this.histogram = histogram;
        if (old) URL.revokeObjectURL(old);
      } catch (error) {
        if (current === generation && preview === previewGeneration) this.failure(error);
      } finally {
        sampling = false;
      }
    },
    close() {
      generation++;
      controller?.abort();
      controller = null;
      events?.close();
      events = null;
      this.streamConnected = false;
      if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    },
  },
});
