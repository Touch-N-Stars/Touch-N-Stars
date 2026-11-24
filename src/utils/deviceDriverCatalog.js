/**
 * Brand -> INDI driver for cameras and filter wheels on PINS.
 *
 * Unlike mounts (see mountDriverCatalog.js) one driver serves all models of a brand, so the
 * brand is all the user has to know. Brands whose right driver depends on the model or on how
 * the device is connected (Atik wheels, QHY wheels behind the camera) are left out on purpose:
 * the full driver list stays below the finder.
 *
 * Every driver name is in the driver list of a real PINS and every package in the 3rd party
 * release the pinsdaemon installs from (2026-11-24). Which package brings which driver follows
 * INDI's naming; it only matters on a PINS that does not have the driver yet, and the finder
 * checks the driver list again after an install.
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

/** 'installed' | 'installable' | 'unavailable', as driverAvailability() for mounts. */
export function brandAvailability(entry, installedDrivers) {
  if (!entry) return null;
  if ((installedDrivers ?? []).includes(entry.driver)) return 'installed';
  return entry.package ? 'installable' : 'unavailable';
}
