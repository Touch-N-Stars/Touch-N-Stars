// Auto-opening the setup wizard for a new PINS profile.
//
// "New" is detected purely in the frontend: a freshly flashed image and a
// profile added in the profile manager both come up with no device selected.
// The seen-list keeps the wizard from reopening on every start once the user
// has been offered it for that profile (e.g. cancelled without picking a device).

const SEEN_PROFILES_KEY = 'setupWizardSeenProfiles';

// Same device sections as apiStore.getExistingEquipment(). Read from the profile
// itself rather than from existingEquipmentList: clearAllStates() empties that
// list on every transient connection loss while the profile stays, so a set-up
// profile would briefly look new.
// GuiderSettings is left out on purpose: a new profile already comes with
// GuiderName 'PHD2', so it says nothing about whether the rig was set up.
const DEVICE_SETTINGS = [
  'CameraSettings',
  'DomeSettings',
  'FilterWheelSettings',
  'FocuserSettings',
  'SwitchSettings',
  'TelescopeSettings',
  'SafetyMonitorSettings',
  'FlatDeviceSettings',
  'RotatorSettings',
  'WeatherDataSettings',
];

export function profileHasEquipment(profile) {
  if (!profile) return false;
  return DEVICE_SETTINGS.some((key) => {
    const id = profile[key]?.Id;
    return Boolean(id) && id !== 'No_Device';
  });
}

export function shouldOfferWizardForProfile({ isPINS, profileId, hasEquipment, seenIds }) {
  if (!isPINS || !profileId || hasEquipment) return false;
  return !seenIds.includes(profileId);
}

export function loadSeenProfileIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_PROFILES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markProfileSeen(profileId) {
  if (!profileId) return;
  const seen = loadSeenProfileIds();
  if (seen.includes(profileId)) return;
  try {
    localStorage.setItem(SEEN_PROFILES_KEY, JSON.stringify([...seen, profileId]));
  } catch {
    // Storage unavailable - worst case the wizard is offered once more.
  }
}
