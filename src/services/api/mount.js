import axios from 'axios';
import { getUrls, simpleGetRequest } from './core';

export default {
  //-------------------------------------  Mount ---------------------------------------
  mountAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/mount/${action}`);
  },

  mountCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/mount/cancel-connect`);
  },

  async setTrackingMode(TrackingMode) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/tracking`, {
        params: { mode: TrackingMode },
      });
      return response.data;
    } catch (error) {
      // console.error('Error setTrackingMode:', error);
      throw error;
    }
  },

  async moveAxis(direction, rate = 8) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/move-axis`, {
        params: {
          direction,
          rate,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error moveAxis:', error);
      throw error;
    }
  },

  async moveAxisStop() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/move-axis/stop`, {
        params: {},
      });
      return response.data;
    } catch (error) {
      // console.error('Error moveAxisStop:', error);
      throw error;
    }
  },

  async getMountGuideRate() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}equipment/mount/guiderate`);
  },

  async setMountGuideRate(raSiderealMultiplier, decSiderealMultiplier) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}equipment/mount/guiderate`, {
        raSiderealMultiplier,
        decSiderealMultiplier,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Manual-slew rate capability of the connected INDI mount (discrete steps / continuous range / none)
  async getMountSlewRates() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}indi/mount/slew-rates`);
      return response.data;
    } catch (error) {
      console.error('Error fetching mount slew rates:', error);
      throw error;
    }
  },

  // Select the mount slew rate: { index } for discrete drivers, { value } (°/s) for continuous ones
  async setMountSlewRate(selection) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}indi/mount/slew-rate`, selection);
      return response.data;
    } catch (error) {
      console.error('Error setting mount slew rate:', error);
      throw error;
    }
  },

  // Settings stored in the controller of pins' native OnStepX driver. Every route answers 404
  // unless that driver is connected, and 400 with the controller's reason for a refused value.
  async getOnStepXSettings() {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}onstepx/settings`);
    return response.data;
  },

  // Lowest (-30..30) and highest (60..90) altitude in whole degrees
  async setOnStepXAltitudeLimits(min, max) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/altitude-limits`, { min, max });
    return response.data;
  },

  // Degrees past the meridian the mount may track on each pier side (-360..360, 0.25° steps)
  async setOnStepXMeridianLimits(east, west) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/meridian-limits`, { east, west });
    return response.data;
  },

  // "East" | "West" | "Best", or "" to keep the mount's own choice
  async setOnStepXPreferredPierSide(side) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/preferred-pier-side`, { side });
    return response.data;
  },

  // Makes the current position home (:hF#); the mount must point at the pole and stand still
  async setOnStepXHome() {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/set-home`);
    return response.data;
  },

  // Vendor settings of a Proxisky UMi on the native OnStepX driver, read from the mount on every
  // call. 404 unless a UMi is connected; null values are features this mount does not have.
  async getProxiskySettings() {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}onstepx/proxisky`);
    return response.data;
  },

  // setting: StatusLed, PowerLossMemory, AsiairHoming, SupervisedHome, DecSecondHome,
  // AutoTracking, RaLimits, DecLimits, AntiCollision or SupervisedGoto
  async setProxiskySwitch(setting, enabled) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/switch`, { setting, enabled });
    return response.data;
  },

  // RA travel limits in whole degrees on the vendor's "left" and "right" side (1..180)
  async setProxiskyRaLimits(left, right) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/ra-limits`, { left, right });
    return response.data;
  },

  // Dec travel limits in whole degrees counter-clockwise and clockwise (90..200), UMi17X only
  async setProxiskyDecLimits(ccw, cw) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/dec-limits`, { ccw, cw });
    return response.data;
  },

  // Anti-collision thresholds: RA 10..59999, Dec 100..59999
  async setProxiskyAcsThresholds(ra, dec) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/acs-thresholds`, { ra, dec });
    return response.data;
  },

  async clearProxiskyCollisionCounters() {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/acs-clear`);
    return response.data;
  },

  // Supervised goto tolerance in whole degrees (5..30)
  async setProxiskySupervisedGotoTolerance(degrees) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/supervised-goto-tolerance`, {
      degrees,
    });
    return response.data;
  },

  // axis "Ra" | "Dec"; gains { angleKp, angleKi, speedKp, speedKi }: 11..1999, speedKi 11..80.
  // Refused while the mount moves or tracks; takes effect after a power cycle.
  async setProxiskyPid(axis, gains) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}onstepx/proxisky/pid`, { axis, ...gains });
    return response.data;
  },
};
