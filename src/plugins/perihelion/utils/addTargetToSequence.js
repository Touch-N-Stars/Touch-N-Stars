import perihelionApi from './perihelionClient';
import i18n from '@/i18n';
import { getUrls } from '@/services/api/core';
import { describePerihelionResponse, describePerihelionError } from './perihelionResult';

/**
 * "Add to Sequence" — appends one target to whatever Advanced Sequence is already loaded in
 * NINA, via Perihelion's own in-process ISequenceMediator.AddAdvancedTarget path (see
 * PerihelionSequenceBuilder.cs, shared with the Windows dockable panel's own Add to Sequence
 * button). Unlike the old buildPerihelionSequence.js + apiService.sequenceLoadJson route
 * (still used by onDownloadSequence for the "save as file" case), this never replaces the
 * loaded sequence — it genuinely appends, matching the Windows panel's own behavior.
 *
 * @param {object} target - same shape as buildSequenceTarget() in PerihelionView.vue.
 * @param {'comet'|'asteroid'} target.objectType
 * @param {string} target.targetName
 * @param {number} target.raHours
 * @param {number} target.decDeg
 * @param {boolean} target.guiding
 * @param {boolean} target.meridianFlip
 * @param {number|null} target.autofocusMinutes
 * @param {{ raDeg: number, decDeg: number }|null} target.frameOffset
 * @param {number|null} target.rotationAngle
 * @param {{ filterName: string|null, exposureSeconds: number, frameCount: number }} target.exposure
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function addTargetToSequence(target) {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.post(`${PERIHELION_URL}/sequence/add-target`, {
      ObjectType: target.objectType === 'comet' ? 'Comet' : 'Asteroid',
      TargetName: target.targetName,
      RaHours: target.raHours,
      DecDeg: target.decDeg,
      FrameOffsetRaDeg: target.frameOffset?.raDeg ?? null,
      FrameOffsetDecDeg: target.frameOffset?.decDeg ?? null,
      RotationAngle: target.rotationAngle ?? null,
      Guiding: !!target.guiding,
      MeridianFlip: !!target.meridianFlip,
      AutofocusMinutes: target.autofocusMinutes ?? null,
      Exposure: {
        FilterName: target.exposure?.filterName || null,
        ExposureSeconds: target.exposure?.exposureSeconds ?? 0,
        FrameCount: target.exposure?.frameCount ?? 1,
      },
    });
    // A 404 here means the route itself doesn't exist -- an older Perihelion plugin than this
    // feature needs, not a business-logic failure. The global axios interceptor resolves this
    // rather than rejecting (see perihelionResult.js's own doc comment), so it surfaces here as
    // a normal response, not a caught error.
    if (response.status === 404) {
      return { ok: false, message: i18n.global.t('perihelion.status.backendTooOld') };
    }
    return describePerihelionResponse(response.data);
  } catch (error) {
    return describePerihelionError(error);
  }
}
