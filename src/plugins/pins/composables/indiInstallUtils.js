/**
 * @typedef {'filterwheel' | 'flatpanel' | 'focuser' | 'rotator' | 'switches' | 'telescope' | 'weather'} IndiDriverType
 */

/**
 * @typedef {Object} IndiInstallSelection
 * @property {string} assetName
 * @property {string} [name]
 * @property {string} [packageName]
 * @property {string} [label]
 * @property {string} [type]
 * @property {string} [driverType]
 * @property {string} [deviceType]
 * @property {string} [category]
 * @property {string} [description]
 */

/**
 * @typedef {Object} IndiInstallFormInput
 * @property {string} type
 * @property {string} label
 */

/**
 * @typedef {Object} Indi3rdpartyInstallPayload
 * @property {string} assetName
 * @property {IndiDriverType} type
 * @property {string} label
 */

/**
 * @typedef {Object} Indi3rdpartyInstallResponse
 * @property {string | number} [jobId]
 * @property {string} [message]
 */

export const ALLOWED_INDI_DRIVER_TYPES = Object.freeze([
  'filterwheel',
  'flatpanel',
  'focuser',
  'rotator',
  'switches',
  'telescope',
  'weather',
]);

const TYPE_KEYWORDS = Object.freeze({
  filterwheel: ['filterwheel', 'filter wheel', 'efw'],
  flatpanel: ['flatpanel', 'flat panel', 'flatbox', 'light box', 'flatdevice', 'flat device'],
  focuser: ['focuser', 'focus', 'eaf'],
  rotator: ['rotator', 'derotator'],
  switches: ['switch', 'relay', 'gpio', 'powerbox', 'power box'],
  telescope: ['telescope', 'mount', 'eqmod', 'lx200'],
  weather: ['weather', 'meteo', 'rain', 'cloud'],
});

function asString(value) {
  return typeof value === 'string' ? value : '';
}

export function isValidIndiDriverType(type) {
  return ALLOWED_INDI_DRIVER_TYPES.includes(asString(type).trim());
}

export function normalizeIndiLabel(label) {
  return asString(label).trim();
}

export function getIndiInstallDisplayName(selection) {
  if (!selection || typeof selection !== 'object') {
    return '';
  }

  return (
    asString(selection.name).trim() ||
    asString(selection.label).trim() ||
    asString(selection.packageName).trim() ||
    asString(selection.assetName).trim()
  );
}

export function inferIndiDriverType(selection) {
  if (!selection || typeof selection !== 'object') {
    return 'switches';
  }

  const explicitTypeCandidates = [
    selection.type,
    selection.driverType,
    selection.deviceType,
    selection.category,
  ]
    .map((item) => asString(item).trim().toLowerCase())
    .filter(Boolean);

  const explicitType = explicitTypeCandidates.find((candidate) => isValidIndiDriverType(candidate));
  if (explicitType) {
    return explicitType;
  }

  const searchCorpus = [
    selection.name,
    selection.assetName,
    selection.packageName,
    selection.description,
  ]
    .map((item) => asString(item).toLowerCase())
    .join(' ');

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => searchCorpus.includes(keyword))) {
      return type;
    }
  }

  return 'switches';
}

export function validateIndiInstallForm(formInput) {
  const normalizedType = asString(formInput?.type).trim();
  const normalizedLabel = normalizeIndiLabel(formInput?.label);

  const typeError = isValidIndiDriverType(normalizedType)
    ? ''
    : 'Type must be one of the allowed values.';

  let labelError = '';
  if (!normalizedLabel) {
    labelError = 'Label is required.';
  } else if (normalizedLabel.length > 200) {
    labelError = 'Label must be 200 characters or fewer.';
  }

  return {
    isValid: !typeError && !labelError,
    normalizedType,
    normalizedLabel,
    typeError,
    labelError,
  };
}

/**
 * @param {IndiInstallSelection} selection
 * @param {IndiInstallFormInput} formInput
 * @returns {Indi3rdpartyInstallPayload}
 */
export function buildIndiInstallPayload(selection, formInput) {
  const validation = validateIndiInstallForm(formInput);

  if (!validation.isValid) {
    throw new Error('Cannot build INDI install payload from invalid form input.');
  }

  const assetName = asString(selection?.assetName).trim();
  if (!assetName) {
    throw new Error('Cannot build INDI install payload without assetName.');
  }

  return {
    assetName,
    type: validation.normalizedType,
    label: validation.normalizedLabel,
  };
}

export function parseIndiInstallJobId(data) {
  if (
    data &&
    typeof data === 'object' &&
    (typeof data.jobId === 'string' || typeof data.jobId === 'number')
  ) {
    return data.jobId;
  }

  if (typeof data === 'string' || typeof data === 'number') {
    return data;
  }

  return null;
}

export function extractIndiInstallErrorDetail(error) {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.detail === 'string' && responseData.detail.trim()) {
      return responseData.detail.trim();
    }
    if (typeof responseData.message === 'string' && responseData.message.trim()) {
      return responseData.message.trim();
    }

    try {
      return JSON.stringify(responseData);
    } catch {
      // no-op
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return 'Unknown install error.';
}
