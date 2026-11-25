/**
 * Brand -> INDI driver for cameras, focusers and filter wheels on PINS.
 *
 * Unlike mounts (see mountDriverCatalog.js) one driver serves all models of a brand, so the
 * brand is all the user has to know. Focuser makers use a driver per model, so those entries
 * name the model as well. Brands whose right driver depends on the model or on how
 * the device is connected (Atik wheels, QHY wheels behind the camera) are left out on purpose:
 * the full driver list stays below the finder.
 *
 * Every driver name is in the driver list of a real PINS and every package in the 3rd party
 * release the pinsdaemon installs from (2026-11-24). Which package brings which driver follows
 * INDI's naming; it only matters on a PINS that does not have the driver yet, and the finder
 * checks the driver list again after an install.
 *
 * The daemon registers only those drivers of a package whose name matches the package, so of
 * indi-toupbase only ToupTek's own focuser shows up after an install. The rebranded AAF
 * focusers therefore name no package: they work where PINS already lists them.
 */
const TOUPBASE = 'indi-toupbase';

export const DEVICE_BRANDS = Object.freeze({
  camera: [
    { brand: 'ZWO', driver: 'indi_asi_ccd', package: 'indi-asi' },
    { brand: 'QHYCCD', driver: 'indi_qhy_ccd', package: 'indi-qhy' },
    { brand: 'Player One', driver: 'indi_playerone_ccd', package: 'indi-playerone' },
    { brand: 'ToupTek', driver: 'indi_toupcam_ccd', package: TOUPBASE },
    { brand: 'SVBONY', driver: 'indi_svbony_ccd', package: 'indi-svbony' },
    { brand: 'Altair', driver: 'indi_altaircam_ccd', package: TOUPBASE },
    { brand: 'Omegon', driver: 'indi_omegonprocam_ccd', package: TOUPBASE },
    { brand: 'OGMA', driver: 'indi_ogmacam_ccd', package: TOUPBASE },
    { brand: 'Bresser', driver: 'indi_bressercam_ccd', package: TOUPBASE },
    { brand: 'MallinCam', driver: 'indi_mallincam_ccd', package: TOUPBASE },
    { brand: 'Atik', driver: 'indi_atik_ccd', package: 'indi-atik' },
    { brand: 'Starlight Xpress', driver: 'indi_sx_ccd', package: 'indi-sx' },
    { brand: 'Moravian (USB)', driver: 'indi_mi_ccd_usb', package: 'indi-mi' },
    { brand: 'FLI', driver: 'indi_fli_ccd', package: 'indi-fli' },
    { brand: 'QSI', driver: 'indi_qsi_ccd', package: 'indi-qsi' },
    { brand: 'SBIG', driver: 'indi_sbig_ccd', package: 'indi-sbig' },
    { brand: 'Canon', driver: 'indi_canon_ccd', package: 'indi-gphoto' },
    { brand: 'Nikon', driver: 'indi_nikon_ccd', package: 'indi-gphoto' },
    { brand: 'Sony', driver: 'indi_sony_ccd', package: 'indi-gphoto' },
    { brand: 'Fujifilm', driver: 'indi_fuji_ccd', package: 'indi-gphoto' },
  ],
  focuser: [
    { brand: 'ZWO EAF', driver: 'indi_asi_focuser', package: 'indi-asi' },
    { brand: 'QHY Q-Focuser', driver: 'indi_qhy_focuser', package: 'indi-qhy' },
    { brand: 'Gemini EAF', driver: 'indi_myfocuserpro2_focus' },
    { brand: 'ToupTek AAF', driver: 'indi_toupcam_focuser', package: TOUPBASE },
    { brand: 'Altair AAF', driver: 'indi_altaircam_focuser' },
    { brand: 'Omegon AAF', driver: 'indi_omegonprocam_focuser' },
    { brand: 'OGMA AAF', driver: 'indi_ogmacam_focuser' },
    { brand: 'Bresser AAF', driver: 'indi_bressercam_focuser' },
    { brand: 'Astroasis Oasis', driver: 'indi_oasis_focuser', package: 'indi-astroasis' },
    { brand: 'iOptron iEAF', driver: 'indi_ieaf_focus' },
    { brand: 'Pegasus FocusCube 3', driver: 'indi_pegasus_focuscube3' },
    { brand: 'Pegasus FocusCube 1/2', driver: 'indi_pegasus_focuscube' },
    { brand: 'Pegasus DMFC', driver: 'indi_dmfc_focus' },
    { brand: 'PrimaLuceLab Sesto Senso 2', driver: 'indi_sestosenso2_focus' },
    { brand: 'PrimaLuceLab Sesto Senso', driver: 'indi_sestosenso_focus' },
    { brand: 'PrimaLuceLab Esatto', driver: 'indi_esatto_focus' },
    { brand: 'PrimaLuceLab Esatto + ARCO', driver: 'indi_esattoarco_focus' },
    { brand: 'Celestron (USB)', driver: 'indi_celestron_sct_focus' },
    { brand: 'Deep Sky Dad AF1', driver: 'indi_deepskydad_af1_focus' },
    { brand: 'Deep Sky Dad AF2', driver: 'indi_deepskydad_af2_focus' },
    { brand: 'Deep Sky Dad AF3', driver: 'indi_deepskydad_af3_focus' },
    { brand: 'Baader SteelDrive II', driver: 'indi_steeldrive2_focus' },
    { brand: 'MyFocuserPro2', driver: 'indi_myfocuserpro2_focus' },
    { brand: 'MoonLite', driver: 'indi_moonlite_focus' },
    { brand: 'MoonLite DRO', driver: 'indi_moonlitedro_focus' },
    { brand: 'Lacerta MFOC', driver: 'indi_lacerta_mfoc_focus' },
    { brand: 'Lakeside', driver: 'indi_lakeside_focus' },
    { brand: 'USB Focus v3', driver: 'indi_usbfocusv3_focus' },
    { brand: 'Rigel nStep', driver: 'indi_nstep_focus' },
    { brand: 'RoboFocus', driver: 'indi_robo_focus' },
    { brand: 'RainbowAstro RSF', driver: 'indi_rainbowrsf_focus' },
    { brand: 'Gemini Integra', driver: 'indi_integra_focus' },
    { brand: 'Optec TCF-S', driver: 'indi_tcfs_focus' },
    { brand: 'FLI', driver: 'indi_fli_focus', package: 'indi-fli' },
  ],
  filterwheel: [
    { brand: 'ZWO', driver: 'indi_asi_wheel', package: 'indi-asi' },
    { brand: 'Player One', driver: 'indi_playerone_wheel', package: 'indi-playerone' },
    { brand: 'ToupTek', driver: 'indi_toupcam_wheel', package: TOUPBASE },
    { brand: 'Altair', driver: 'indi_altaircam_wheel', package: TOUPBASE },
    { brand: 'Omegon', driver: 'indi_omegonprocam_wheel', package: TOUPBASE },
    { brand: 'OGMA', driver: 'indi_ogmacam_wheel', package: TOUPBASE },
    { brand: 'Pegasus Astro', driver: 'indi_pegasusindigo_wheel' },
    { brand: 'Astroasis (Oasis)', driver: 'indi_oasis_filter_wheel', package: 'indi-astroasis' },
    { brand: 'Starlight Xpress', driver: 'indi_sx_wheel', package: 'indi-sx' },
    { brand: 'Moravian (USB)', driver: 'indi_mi_sfw_usb', package: 'indi-mi' },
    { brand: 'FLI', driver: 'indi_fli_wheel', package: 'indi-fli' },
    { brand: 'iOptron', driver: 'indi_ioptron_wheel' },
    { brand: 'Optec', driver: 'indi_optec_wheel' },
    { brand: 'Xagyl', driver: 'indi_xagyl_wheel' },
  ],
});

/**
 * The driver lists to look a driver up in. The daemon files every driver of a package under
 * "camera" when its name contains e.g. "asi" - the EAF, the EFW and even the Oasis. PINS starts
 * a driver by its name and does not care which list it is in, so such a driver is usable.
 */
export function driverListTypes(deviceType) {
  return [...new Set([deviceType, 'camera'])];
}

/** 'installed' | 'installable' | 'unavailable', as driverAvailability() for mounts. */
export function brandAvailability(entry, installedDrivers) {
  if (!entry) return null;
  if ((installedDrivers ?? []).includes(entry.driver)) return 'installed';
  return entry.package ? 'installable' : 'unavailable';
}
