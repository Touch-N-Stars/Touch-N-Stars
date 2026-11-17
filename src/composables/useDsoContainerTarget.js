import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useFramingStore } from '@/store/framingStore';
import { apiStore } from '@/store/store';
import { raDecToAltAz, degreesToHMS, degreesToDMS } from '@/utils/utils';
import {
  parseDsoTargetString,
  dsoContainerCoordinates,
  dsoContainerRaString,
  dsoContainerDecString,
} from '@/utils/sequenceTargets';

/**
 * Target of one DSO container in the V2 sequence tree: its coordinates for display and the
 * actions that change it. Shared by the full editor's DeepSkyObjectContainerItem and the
 * simple view's target card.
 *
 * @param {() => object} getItem returns the current DSO container (a props getter)
 */
export function useDsoContainerTarget(getItem) {
  const store = useSequenceV2Store();
  const framingStore = useFramingStore();
  const appStore = apiStore();
  const router = useRouter();

  const parsedTarget = computed(() => parseDsoTargetString(getItem().Target, getItem().Name ?? ''));
  const coords = computed(() => dsoContainerCoordinates(getItem()));
  const raStr = computed(() => dsoContainerRaString(getItem()));
  const decStr = computed(() => dsoContainerDecString(getItem()));

  const decDeg = computed(() => {
    const co = coords.value;
    const isNegative = co.NegativeDec || (co.DecDegrees ?? 0) < 0;
    const absDeg = Math.abs(co.DecDegrees ?? 0);
    return isNegative ? -absDeg : absDeg;
  });

  const positionAngle = computed(
    () => parsedTarget.value?.PositionAngle ?? getItem().Target?.PositionAngle ?? 0
  );
  const displayPositionAngle = computed(() => Number(positionAngle.value).toFixed(2));

  const targetName = computed(
    () => parsedTarget.value?.TargetName || getItem().Target?.TargetName || getItem().Name || ''
  );

  const currentRaDeg = computed(() => {
    const c = coords.value;
    return ((c.RAHours ?? 0) + (c.RAMinutes ?? 0) / 60 + (c.RASeconds ?? 0) / 3600) * 15;
  });
  const currentDecDeg = computed(() => {
    const c = coords.value;
    const isNegative = c.NegativeDec || (c.DecDegrees ?? 0) < 0;
    const abs = Math.abs(c.DecDegrees ?? 0) + (c.DecMinutes ?? 0) / 60 + (c.DecSeconds ?? 0) / 3600;
    return isNegative ? -abs : abs;
  });

  // null for any argument keeps the container's current value
  function callSetTarget(raDeg, decDeg, name, rotation) {
    return store.setDsoTarget(
      getItem().Id,
      name ?? parsedTarget.value?.TargetName ?? getItem().Name ?? '',
      raDeg ?? currentRaDeg.value,
      decDeg ?? currentDecDeg.value,
      rotation ?? parsedTarget.value?.PositionAngle ?? 0
    );
  }

  // Result of the object search (TargetSearch.vue)
  function setFromSearch(targetData) {
    return store.setDsoTarget(
      getItem().Id,
      targetData.name || parsedTarget.value?.TargetName || getItem().Name || '',
      targetData.originalData?.RA ?? currentRaDeg.value,
      targetData.originalData?.Dec ?? currentDecDeg.value,
      parsedTarget.value?.PositionAngle ?? 0
    );
  }

  // A favorite from DsoFavoritePickerModal
  function setFromFavorite(target) {
    return callSetTarget(target.Ra, target.Dec, target.Name, target.Rotation ?? 0);
  }

  // Read-only direction: copy this container's target into the framing assistant.
  // Nothing is written back to the sequence and no hardware is moved.
  const canLoadIntoFraming = computed(() => parsedTarget.value !== null);

  function loadIntoFraming() {
    if (!canLoadIntoFraming.value) return;

    const ra = currentRaDeg.value;
    const dec = currentDecDeg.value;
    const name = parsedTarget.value?.TargetName || getItem().Name || '';

    framingStore.RAangle = ra;
    framingStore.DECangle = dec;
    // degreesToHMS/DMS so slewAndCenter.vue can parse the strings back.
    framingStore.RAangleString = degreesToHMS(ra);
    framingStore.DECangleString = degreesToDMS(dec);
    framingStore.rotationAngle = parsedTarget.value?.PositionAngle ?? 0;
    framingStore.isMosaicMode = false;
    framingStore.selectedItem = { Name: name, RA: ra, Dec: dec };

    const { altitude, azimuth } = raDecToAltAz(
      ra,
      dec,
      appStore.profileInfo?.AstrometrySettings?.Latitude ?? 0,
      appStore.profileInfo?.AstrometrySettings?.Longitude ?? 0
    );
    framingStore.ALTangle = altitude;
    framingStore.AZangle = azimuth;
    framingStore.ALTangleString = altitude.toFixed(3);
    framingStore.AZangleString = azimuth.toFixed(3);

    framingStore.framingReloadKey++;
    router.push('/framing');
  }

  return {
    parsedTarget,
    coords,
    raStr,
    decStr,
    decDeg,
    positionAngle,
    displayPositionAngle,
    targetName,
    currentRaDeg,
    currentDecDeg,
    callSetTarget,
    setFromSearch,
    setFromFavorite,
    canLoadIntoFraming,
    loadIntoFraming,
  };
}
