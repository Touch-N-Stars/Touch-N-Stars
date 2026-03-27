// Mock API Service for development/testing without N.I.N.A
// Enable by setting localStorage.setItem('USE_MOCK_API', 'true')
/* eslint-disable */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock state to simulate equipment status
const mockState = {
  isConnected: true,
  apiVersion: '2.2.12.0',
  tnsPluginVersion: '1.2.0.0',
  apiPort: 8000,
  equipment: {
    camera: { connected: true },
    mount: { connected: true },
    filter: { connected: true },
    focuser: { connected: true },
    rotator: { connected: true },
    guider: { connected: true },
    flatdevice: { connected: true },
    dome: { connected: true },
    switch: { connected: true },
    weather: { connected: true },
    safety: { connected: true },
  },
  sequences: [
    {
      path: 'C:\\Users\\User\\Documents\\NINA\\Sequences\\M31_Andromeda.json',
      name: 'M31 Andromeda',
    },
    {
      path: 'C:\\Users\\User\\Documents\\NINA\\Sequences\\M42_Orion.json',
      name: 'M42 Orion Nebula',
    },
    {
      path: 'C:\\Users\\User\\Documents\\NINA\\Sequences\\NGC7000_NorthAmerica.json',
      name: 'NGC 7000 North America',
    },
    {
      path: 'C:\\Users\\User\\Documents\\NINA\\Sequences\\IC1396_Elephant.json',
      name: 'IC 1396 Elephant Trunk',
    },
    {
      path: 'C:\\Users\\User\\Documents\\NINA\\Sequences\\NGC2244_Rosette.json',
      name: 'NGC 2244 Rosette Nebula',
    },
  ],
  favorites: [],
  settings: {},
};

// Device catalogs for connectEquipment
const deviceCatalog = {
  camera: [{ Id: 'ZWO ASI294MC Pro', DisplayName: 'ZWO ASI294MC Pro' }],
  mount: [{ Id: 'Celestron AVX', DisplayName: 'Celestron AVX' }],
  filter: [{ Id: 'ZWO EFW', DisplayName: 'ZWO EFW' }],
  focuser: [{ Id: 'ZWO EAF', DisplayName: 'ZWO EAF' }],
  rotator: [{ Id: 'Mock Rotator', DisplayName: 'Mock Rotator' }],
  guider: [{ Id: 'PHD2_Single', DisplayName: 'PHD2 Single (Mock)' }],
  flatdevice: [{ Id: 'Mock Flat Device', DisplayName: 'Mock Flat Device' }],
  dome: [{ Id: 'Mock Dome', DisplayName: 'Mock Dome' }],
  switch: [{ Id: 'Mock Switch', DisplayName: 'Mock Switch' }],
  weather: [{ Id: 'Mock Weather', DisplayName: 'Mock Weather' }],
  safety: [{ Id: 'Mock Safety', DisplayName: 'Mock Safety' }],
};

const buildDeviceResponse = (deviceKey, action) => {
  if (action === 'list-devices' || action === 'rescan') {
    return {
      Success: true,
      Response: deviceCatalog[deviceKey] || [],
    };
  }
  if (action.startsWith('connect')) {
    mockState.equipment[deviceKey].connected = true;
    return { Success: true, Response: `${deviceKey} connected` };
  }
  if (action === 'disconnect') {
    mockState.equipment[deviceKey].connected = false;
    return { Success: true, Response: `${deviceKey} disconnected` };
  }
  return null;
};

const mockApiService = {
  async fetchApiPort() {
    await delay(100);
    return {
      data: mockState.apiPort,
      status: 200,
    };
  },

  async fetchTnsPluginVersion() {
    await delay(100);
    return {
      version: mockState.tnsPluginVersion,
      status: 200,
    };
  },

  async fetchApiVersion() {
    await delay(100);
    return {
      Success: true,
      Response: mockState.apiVersion,
    };
  },

  async fetchNinaTime() {
    await delay(50);
    return {
      Success: true,
      Response: new Date().toISOString(),
    };
  },

  async getEventHistory() {
    await delay(100);
    const events = [];
    const now = new Date();

    // Map equipment keys to expected event names in store.processEventHistory
    const deviceNameMap = {
      camera: 'CAMERA',
      mount: 'MOUNT',
      filter: 'FILTERWHEEL',
      focuser: 'FOCUSER',
      rotator: 'ROTATOR',
      guider: 'GUIDER',
      flatdevice: 'FLAT',
      dome: 'DOME',
      switch: 'SWITCH',
      weather: 'WEATHER',
      safety: 'SAFETY',
    };

    Object.entries(mockState.equipment).forEach(([device, state], idx) => {
      const mappedName = deviceNameMap[device];
      if (!mappedName) return;
      const timestamp = new Date(now.getTime() - (idx + 1) * 1000).toISOString();
      const eventType = state.connected ? `${mappedName}-CONNECTED` : `${mappedName}-DISCONNECTED`;
      events.push({ Time: timestamp, Event: eventType });
    });

    return {
      Success: true,
      Response: events.sort((a, b) => new Date(b.Time) - new Date(a.Time)),
    };
  },

  // Plugins
  async getPlugins() {
    await delay(100);
    return {
      Success: true,
      Response: [{ Name: "Touch 'N' Stars", Version: '1.2.0.0', Enabled: true }],
    };
  },

  // Favorites
  async getAllFavorites() {
    await delay(100);
    return mockState.favorites;
  },

  async addFavorite(favorite) {
    await delay(100);
    const newFavorite = {
      ...favorite,
      id: Date.now().toString(),
    };
    mockState.favorites.push(newFavorite);
    return newFavorite;
  },

  async updateFavorite(id, updatedFavorite) {
    await delay(100);
    const index = mockState.favorites.findIndex((f) => f.id === id);
    if (index !== -1) {
      mockState.favorites[index] = { ...mockState.favorites[index], ...updatedFavorite };
      return mockState.favorites[index];
    }
    throw new Error('Favorite not found');
  },

  async deleteFavorite(id) {
    await delay(100);
    const index = mockState.favorites.findIndex((f) => f.id === id);
    if (index !== -1) {
      mockState.favorites.splice(index, 1);
      return { success: true };
    }
    throw new Error('Favorite not found');
  },

  // Image History
  async imageHistoryAll() {
    await delay(100);
    return {
      Success: true,
      Response: [],
    };
  },

  async imageHistoryAllFilterd(imageType) {
    await delay(100);
    return {
      Success: true,
      Response: [],
    };
  },

  // Sequence
  sequenceAction(action) {
    return delay(100).then(() => {
      if (action === 'list-available') {
        return {
          Success: true,
          data: mockState.sequences,
        };
      }
      return {
        Success: true,
        Response: `Sequence ${action} executed`,
      };
    });
  },

  async sequenceLoadJson(sequenceName) {
    await delay(200);
    return {
      Success: true,
      Response: `Sequence loaded: ${sequenceName}`,
    };
  },

  async sequnceTargetSet(name, ra, dec, rotation, index) {
    await delay(100);
    return {
      Success: true,
      Response: `Target set: ${name}`,
    };
  },

  // Profile
  profileAction(action) {
    return delay(100).then(() => {
      if (action === 'show?active=true') {
        return {
          Success: true,
          Response: {
            CameraSettings: {
              Id: 'ZWO ASI294MC Pro',
              Temperature: -10,
              CoolingDuration: 10,
              WarmingDuration: 10,
            },
            TelescopeSettings: {
              Id: 'Celestron AVX',
            },
            FilterWheelSettings: {
              Id: 'ZWO EFW',
            },
            FocuserSettings: {
              Id: 'ZWO EAF',
            },
            RotatorSettings: {
              Id: 'Mock Rotator',
            },
            GuiderSettings: {
              GuiderName: 'PHD2_Single',
            },
            FlatDeviceSettings: {
              Id: 'Mock Flat Device',
            },
            DomeSettings: {
              Id: 'Mock Dome',
            },
            SwitchSettings: {
              Id: 'Mock Switch',
            },
            WeatherDataSettings: {
              Id: 'Mock Weather',
            },
            SafetyMonitorSettings: {
              Id: 'Mock Safety',
            },
            AstrometrySettings: {
              Latitude: 40.7128,
              Longitude: -74.006,
              Elevation: 10,
            },
            ImageSettings: {
              AutoStretchFactor: 0.15,
              DetectStars: true,
            },
            FramingAssistantSettings: {
              LastSelectedImageSource: 'SKYATLAS',
              CameraWidth: 3001,
              CameraHeight: 1501,
            },
            SnapShotControlSettings: {
              Save: false,
              Gain: 120,
            },
            PlateSolveSettings: {
              Gain: 120,
              ExposureTime: 5,
            },
            ImageFileSettings: {
              FilePattern: '$TARGET_$FILTER_$EXPOSURE',
              FileType: 'TIFF',
              FilePath: 'C:\\Users\\User\\Pictures\\NINA',
            },
          },
        };
      }
      return {
        Success: true,
        Response: `Profile ${action} executed`,
      };
    });
  },

  async profileChangeValue(settingpath, newValue) {
    await delay(100);
    return {
      Success: true,
      Response: `Setting ${settingpath} changed to ${newValue}`,
    };
  },

  async profileSwitch(profileid) {
    await delay(100);
    return {
      Success: true,
      Response: `Switched to profile ${profileid}`,
    };
  },

  // Camera
  cameraAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('camera', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.camera.connected,
            Name: 'ZWO ASI294MC Pro',
            Temperature: -10.5,
            TargetTemperature: -10,
            CoolerPower: 45.2,
            CoolerOn: true,
            IsExposing: false,
            CanSetTemperature: true,
            HasShutter: true,
            BinX: 1,
            BinY: 1,
            Gain: 120,
            Offset: 30,
            BinningModes: [{ Name: '1x1' }, { Name: '2x2' }],
            ReadoutModes: ['Mode 0', 'Mode 1'],
          },
        };
      }
      return {
        Success: true,
        Response: `Camera ${action} executed`,
      };
    });
  },

  async startCapture(duration, gain, solve, omitImage, save, targetName) {
    await delay(duration * 1000);
    return {
      Success: true,
      Response: 'Capture completed',
    };
  },

  // Mount
  mountAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('mount', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.mount.connected,
            Name: 'Celestron AVX',
            RightAscension: 5.5,
            Declination: 22.0,
            Altitude: 45.0,
            Azimuth: 180.0,
            SideOfPier: 'East',
            Tracking: true,
            TrackingMode: 'Sidereal',
            Slewing: false,
            AtPark: false,
            AtHome: false,
            Coordinates: {
              RADegrees: 82.5, // 5.5 hours * 15 degrees/hour
              Dec: 22.0,
              Altitude: 45.0,
              Azimuth: 180.0,
            },
          },
        };
      }
      return {
        Success: true,
        Response: `Mount ${action} executed`,
      };
    });
  },

  async setTrackingMode(TrackingMode) {
    await delay(100);
    return {
      Success: true,
      Response: `Tracking mode set to ${TrackingMode}`,
    };
  },

  async moveAxis(direction, rate) {
    await delay(100);
    return {
      Success: true,
      Response: `Moving ${direction} at rate ${rate}`,
    };
  },

  async moveAxisStop() {
    await delay(100);
    return {
      Success: true,
      Response: 'Axis movement stopped',
    };
  },

  // Filter
  filterAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('filter', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.filter.connected,
            Name: 'ZWO EFW',
            Position: 0,
            Filters: ['L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII'],
            SelectedFilter: { Name: 'L', Id: 0 },
          },
        };
      }
      return {
        Success: true,
        Response: `Filter ${action} executed`,
      };
    });
  },

  async changeFilter(filterNr) {
    await delay(500);
    return {
      Success: true,
      Response: `Filter changed to position ${filterNr}`,
    };
  },

  // Focuser
  focusAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('focuser', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.focuser.connected,
            Name: 'ZWO EAF',
            Position: 5000,
            IsMoving: false,
            Temperature: 15.5,
            TempCompAvailable: true,
          },
        };
      }
      return {
        Success: true,
        Response: `Focuser ${action} executed`,
      };
    });
  },

  focuserAfAction(action) {
    return delay(100).then(() => {
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            IsRunning: false,
          },
        };
      }
      return {
        Success: true,
        Response: `Autofocus ${action} executed`,
      };
    });
  },

  async moveFocuser(position) {
    await delay(500);
    return {
      Success: true,
      Response: `Focuser moved to ${position}`,
    };
  },

  // Rotator
  rotatorAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('rotator', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.rotator.connected,
            Position: 0,
            MechanicalPosition: 0,
            IsMoving: false,
          },
        };
      }
      return {
        Success: true,
        Response: `Rotator ${action} executed`,
      };
    });
  },

  // Guider
  guiderAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('guider', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.guider.connected,
            Name: 'PHD2',
            State: 'Stopped',
          },
        };
      }
      return {
        Success: true,
        Response: `Guider ${action} executed`,
      };
    });
  },

  // Flat Device
  flatdeviceAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('flatdevice', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.flatdevice.connected,
            LightOn: false,
            Brightness: 0,
            CoverState: 'Unknown',
          },
        };
      }
      return {
        Success: true,
        Response: `Flat device ${action} executed`,
      };
    });
  },

  // Dome
  domeAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('dome', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.dome.connected,
            Azimuth: 0,
            ShutterStatus: 'Closed',
            AtHome: false,
            AtPark: false,
          },
        };
      }
      return {
        Success: true,
        Response: `Dome ${action} executed`,
      };
    });
  },

  // Switch
  switchAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('switch', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.switch.connected,
            Switches: [],
          },
        };
      }
      return {
        Success: true,
        Response: `Switch ${action} executed`,
      };
    });
  },

  // Weather
  weatherAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('weather', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.weather.connected,
            CloudCover: 20,
            DewPoint: 5,
            Humidity: 65,
            Pressure: 1013,
            RainRate: 0,
            SkyBrightness: 18.5,
            SkyQuality: 20.0,
            SkyTemperature: 5,
            StarFWHM: 2.5,
            Temperature: 10,
            WindDirection: 180,
            WindGust: 5,
            WindSpeed: 3,
          },
        };
      }
      return {
        Success: true,
        Response: `Weather ${action} executed`,
      };
    });
  },

  // Safety Monitor
  safetyAction(action) {
    return delay(100).then(() => {
      const base = buildDeviceResponse('safety', action);
      if (base) return base;
      if (action === 'info') {
        return {
          Success: true,
          Response: {
            Connected: mockState.equipment.safety.connected,
            IsSafe: true,
          },
        };
      }
      return {
        Success: true,
        Response: `Safety ${action} executed`,
      };
    });
  },

  // Settings
  async getAllSettings() {
    await delay(100);
    return Object.entries(mockState.settings).map(([key, value]) => ({
      Key: key,
      Value: value,
    }));
  },

  async getSetting(key) {
    await delay(100);
    if (mockState.settings[key] !== undefined) {
      return {
        Success: true,
        Response: {
          Key: key,
          Value: mockState.settings[key],
        },
      };
    }
    return {
      Success: false,
      Error: 'Setting not found',
    };
  },

  async createSetting(setting) {
    await delay(100);
    mockState.settings[setting.Key] = setting.Value;
    return {
      Success: true,
      Response: setting,
    };
  },

  async updateSetting(key, value) {
    await delay(100);
    mockState.settings[key] = value;
    return {
      Success: true,
      Response: { Key: key, Value: value },
    };
  },

  async deleteSetting(key) {
    await delay(100);
    delete mockState.settings[key];
    return {
      Success: true,
    };
  },

  // Default sequence methods
  async getDefaultSequence() {
    return this.getSetting('sequence_creator_default')
      .then((response) => {
        if (response.Success && response.Response && response.Response.Value) {
          return JSON.parse(response.Response.Value);
        }
        return null;
      })
      .catch(() => null);
  },

  async saveDefaultSequence(sequenceData) {
    try {
      await this.createSetting({
        Key: 'sequence_creator_default',
        Value: JSON.stringify(sequenceData),
      });
    } catch (error) {
      await this.updateSetting('sequence_creator_default', JSON.stringify(sequenceData));
    }
  },

  async deleteDefaultSequence() {
    await this.deleteSetting('sequence_creator_default');
  },

  // Dialogs
  async getDialogList() {
    await delay(100);
    return [];
  },

  async getDialogCount() {
    await delay(100);
    return 0;
  },

  // Framing
  framingAction(action) {
    return delay(100).then(() => ({
      Success: true,
      Response: `Framing ${action} executed`,
    }));
  },

  async slewAndCenter(ra, dec, Center, rotate, rotationAngle) {
    await delay(2000);
    return {
      Success: true,
      Response: 'Slew completed',
    };
  },

  // Application
  async applicatioTabSwitch(tab) {
    await delay(100);
    return {
      Success: true,
      Response: `Switched to tab ${tab}`,
    };
  },

  async fetchApplicatioTab() {
    await delay(100);
    return {
      Success: true,
      Response: 'Equipment',
    };
  },

  // Livestack
  async livestackStart() {
    await delay(100);
    return {
      Success: true,
      Response: 'Livestack started',
    };
  },

  async livestackStop() {
    await delay(100);
    return {
      Success: true,
      Response: 'Livestack stopped',
    };
  },

  async livestackStatus() {
    await delay(100);
    return {
      Success: true,
      Response: {
        IsRunning: false,
      },
    };
  },

  async livestackImageAvailable() {
    await delay(100);
    return {
      Success: false,
    };
  },

  // Target picture (framing)
  async searchTargetPic(width, height, fov, ra, dec, useCache) {
    await delay(100);
    // Simple static placeholder image (SVG data URL) so UI shows something in mock mode
    const placeholderSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#111827;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#grad)" />
        <text x="50%" y="45%" fill="#e5e7eb" font-family="Arial, sans-serif" font-size="28" text-anchor="middle">
          Mock Target
        </text>
        <text x="50%" y="55%" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">
          RA: ${ra?.toFixed ? ra.toFixed(2) : ra} / DEC: ${dec?.toFixed ? dec.toFixed(2) : dec}
        </text>
      </svg>`
    );
    return `data:image/svg+xml,${placeholderSvg}`;
  },

  // Logs
  async getLastLogs(count, level) {
    await delay(100);
    const now = Date.now();
    const makeLog = (idx, message, logLevel = 'INFO') => ({
      timestamp: new Date(now - idx * 1000).toISOString(),
      level: logLevel,
      message,
    });
    return [
      makeLog(1, 'Mock: Flats started'),
      makeLog(2, 'Mock: Exposure completed'),
      makeLog(3, 'Mock: Mount tracking'),
    ];
  },

  // mock data for file service
   async getFileDevices() {
    await delay(100);
    return [
      { name: 'Root', path: '/' },
      { name: 'ASTRO-USB', path: '/media/ASTRO-USB' },
    ];
  },
 
  async listFileDirectories(path) {
    await delay(150);
 
    const fs = {
      '/': [
        { name: 'home', path: '/home' },
        { name: 'media', path: '/media' },
        { name: 'mnt', path: '/mnt' },
        { name: 'opt', path: '/opt' },
      ],
      '/home': [
        { name: 'user', path: '/home/user' },
      ],
      '/home/user': [
        { name: 'Documents', path: '/home/user/Documents' },
        { name: 'Pictures', path: '/home/user/Pictures' },
        { name: 'NINA', path: '/home/user/NINA' },
      ],
      '/home/user/Documents': [
        { name: 'Sequences', path: '/home/user/Documents/Sequences' },
        { name: 'Logs', path: '/home/user/Documents/Logs' },
      ],
      '/home/user/Pictures': [
        { name: 'Astrophotos', path: '/home/user/Pictures/Astrophotos' },
        { name: 'Flats', path: '/home/user/Pictures/Flats' },
        { name: 'Darks', path: '/home/user/Pictures/Darks' },
      ],
      '/home/user/Pictures/Astrophotos': [
        { name: 'M31', path: '/home/user/Pictures/Astrophotos/M31' },
        { name: 'M42', path: '/home/user/Pictures/Astrophotos/M42' },
        { name: 'NGC7000', path: '/home/user/Pictures/Astrophotos/NGC7000' },
      ],
      '/home/user/NINA': [
        { name: 'Images', path: '/home/user/NINA/Images' },
        { name: 'Sequences', path: '/home/user/NINA/Sequences' },
        { name: 'Plugins', path: '/home/user/NINA/Plugins' },
      ],
      '/home/user/NINA/Images': [
        { name: 'Light', path: '/home/user/NINA/Images/Light' },
        { name: 'Dark', path: '/home/user/NINA/Images/Dark' },
        { name: 'Flat', path: '/home/user/NINA/Images/Flat' },
        { name: 'Bias', path: '/home/user/NINA/Images/Bias' },
      ],
      '/media': [
        { name: 'ASTRO-USB', path: '/media/ASTRO-USB' },
      ],
      '/media/ASTRO-USB': [
        { name: 'NINA', path: '/media/ASTRO-USB/NINA' },
        { name: 'Backup', path: '/media/ASTRO-USB/Backup' },
      ],
      '/media/ASTRO-USB/NINA': [
        { name: 'Images', path: '/media/ASTRO-USB/NINA/Images' },
        { name: 'Sequences', path: '/media/ASTRO-USB/NINA/Sequences' },
      ],
      '/media/ASTRO-USB/NINA/Images': [
        { name: 'Light', path: '/media/ASTRO-USB/NINA/Images/Light' },
        { name: 'Dark', path: '/media/ASTRO-USB/NINA/Images/Dark' },
        { name: 'Flat', path: '/media/ASTRO-USB/NINA/Images/Flat' },
      ],
      '/media/ASTRO-USB/Backup': [
        { name: '2024-01', path: '/media/ASTRO-USB/Backup/2024-01' },
        { name: '2024-02', path: '/media/ASTRO-USB/Backup/2024-02' },
      ],
      '/mnt': [],
      '/opt': [],
    };
 
    // Dynamisch angelegte Ordner aus mockState berücksichtigen
    const dynamic = mockState.createdDirs?.[path] || [];
    const base = fs[path] ?? [];
    return [...base, ...dynamic];
  },
 
  async createFileDirectory(path, name) {
    await delay(200);
 
    // Neu angelegten Ordner im mockState merken damit er beim nächsten listFileDirectories auftaucht
    if (!mockState.createdDirs) mockState.createdDirs = {};
    if (!mockState.createdDirs[path]) mockState.createdDirs[path] = [];
 
    const newEntry = { name, path: `${path}/${name}` };
 
    // Doppelte verhindern
    const exists = mockState.createdDirs[path].some((e) => e.name === name);
    if (exists) throw new Error('Directory already exists');
 
    mockState.createdDirs[path].push(newEntry);
    return newEntry;
  },
};



// Export mock state for testing/manipulation
export { mockState };
export default mockApiService;
