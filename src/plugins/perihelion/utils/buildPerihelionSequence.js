/**
 * Builds a minimal NINA Advanced Sequencer JSON for "Add to Sequence": a real slew to the
 * comet/asteroid's current position, Perihelion's own custom tracking-rate item (and
 * optionally its guider-shift counterpart), and a single-filter imaging loop.
 *
 * $id/$ref/Parent shape matches OryxAstro's own sequenceExport.ts (buildNinaSequence) and
 * this app's own sequence-creator plugin (sequenceStore.js, createBasicDeepSkyObjectContainer)
 * almost field-for-field -- cross-checked against both before writing this, since a missing
 * $id/$ref/Parent link is what silently breaks NINA's own delete/edit commands on a loaded
 * sequence (see sequenceExport.ts's own header comment for the real incident that taught that
 * lesson on the website side).
 *
 * Deliberately does NOT reuse sequence-creator's own createBasicDeepSkyObjectContainer --
 * that function is shaped around its drag-drop editor's "action" object model, which would
 * mean adapting Perihelion's own simple one-shot payload into an unrelated UI data shape for
 * no real benefit. This file is self-contained and only produces exactly what "Add to
 * Sequence" needs.
 */

const OBSERVABLE_ITEM_COLLECTION =
  'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel';
const OBSERVABLE_CONDITION_COLLECTION =
  'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel';
const OBSERVABLE_TRIGGER_COLLECTION =
  'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel';
const SEQUENTIAL_STRATEGY = {
  $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
};

/** Decimal hours -> NINA's {RAHours, RAMinutes, RASeconds} sexagesimal fields. */
function raHoursToNinaFields(raHours) {
  const totalSeconds = Math.round(((raHours % 24) + 24) % 24 * 3600 * 1000) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { RAHours: hours, RAMinutes: minutes, RASeconds: seconds };
}

/** Decimal degrees -> NINA's {NegativeDec, DecDegrees, DecMinutes, DecSeconds} sexagesimal fields. */
function decDegToNinaFields(decDeg) {
  const negative = decDeg < 0;
  const totalSeconds = Math.round(Math.abs(decDeg) * 3600 * 1000) / 1000;
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { NegativeDec: negative, DecDegrees: degrees, DecMinutes: minutes, DecSeconds: seconds };
}

/**
 * @param {object} target
 * @param {'comet'|'asteroid'} target.objectType
 * @param {string} target.targetName - must exact-match Perihelion's own lookup (MPC feed name for a comet, BrightAsteroids name for an asteroid).
 * @param {number} target.raHours - current position, decimal hours (for the GoTo/plate-solve slew; Perihelion computes its own live rate independently at Execute() time).
 * @param {number} target.decDeg - current position, decimal degrees.
 * @param {boolean} target.guiding - also add SetPerihelionGuiderShiftRate after StartGuiding.
 * @param {{ filterName: string, exposureSeconds: number, frameCount: number }} target.exposure
 * @returns {object} a full NINA SequenceRootContainer, ready for sequenceApi.sequenceLoadJson(JSON.stringify(root)).
 */
export function buildPerihelionSequence(target) {
  let idCounter = 1;
  const nextId = () => String(idCounter++);
  const ref = (id) => ({ $ref: id });

  const itemsColl = (values) => ({ $id: nextId(), $type: OBSERVABLE_ITEM_COLLECTION, $values: values });
  const conditionsColl = (values) => ({ $id: nextId(), $type: OBSERVABLE_CONDITION_COLLECTION, $values: values });
  const triggersColl = (values) => ({ $id: nextId(), $type: OBSERVABLE_TRIGGER_COLLECTION, $values: values });

  function finishContainer(id, type, name, parentId, conditions, items, triggers) {
    return {
      $id: id,
      $type: type,
      Strategy: SEQUENTIAL_STRATEGY,
      Name: name,
      Conditions: conditionsColl(conditions),
      IsExpanded: true,
      Items: itemsColl(items),
      Triggers: triggersColl(triggers),
      Parent: parentId ? ref(parentId) : null,
      ErrorBehavior: 0,
      Attempts: 1,
    };
  }

  function leafItem(type, parentId, extraFields = {}) {
    return { $id: nextId(), $type: type, ...extraFields, Parent: ref(parentId), ErrorBehavior: 0, Attempts: 1 };
  }

  function coordinatesNode(ra, dec) {
    return { $id: nextId(), $type: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry', ...ra, ...dec };
  }

  function ninaUnparkScope(parentId) {
    return leafItem('NINA.Sequencer.SequenceItem.Telescope.UnparkScope, NINA.Sequencer', parentId);
  }

  function ninaCenterAndRotate(parentId, coordinates) {
    return leafItem('NINA.Sequencer.SequenceItem.Platesolving.CenterAndRotate, NINA.Sequencer', parentId, {
      PositionAngle: 0,
      Inherited: true,
      Coordinates: coordinates,
    });
  }

  const perihelionObjectType = target.objectType === 'comet' ? 'Comet' : 'Asteroid';

  function ninaSetPerihelionTrackingRate(parentId) {
    return leafItem('Perihelion.SequenceItems.SetPerihelionTrackingRate, Perihelion', parentId, {
      ObjectType: perihelionObjectType,
      TargetName: target.targetName,
    });
  }

  function ninaSetPerihelionGuiderShiftRate(parentId) {
    return leafItem('Perihelion.SequenceItems.SetPerihelionGuiderShiftRate, Perihelion', parentId, {
      ObjectType: perihelionObjectType,
      TargetName: target.targetName,
    });
  }

  function ninaStartGuiding(parentId) {
    return leafItem('NINA.Sequencer.SequenceItem.Guider.StartGuiding, NINA.Sequencer', parentId, {
      ForceCalibration: false,
    });
  }

  function ninaSwitchFilter(parentId, filterName) {
    return leafItem('NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter, NINA.Sequencer', parentId, {
      Filter: null,
      ComboBoxText: filterName,
    });
  }

  function ninaTakeExposure(parentId, exposureSeconds) {
    return leafItem('NINA.Sequencer.SequenceItem.Imaging.TakeExposure, NINA.Sequencer', parentId, {
      ExposureTime: exposureSeconds,
      Gain: -1,
      Offset: -1,
      Binning: { $id: nextId(), $type: 'NINA.Core.Model.Equipment.BinningMode, NINA.Core', X: 1, Y: 1 },
      ImageType: 'LIGHT',
      ExposureCount: 0,
    });
  }

  function buildFilterLoop(parentId) {
    const id = nextId();
    const { filterName, exposureSeconds, frameCount } = target.exposure;
    const loopName = filterName ? `${filterName} x ${exposureSeconds}s` : `Exposure Loop - ${target.targetName}`;
    const conditions = [
      { $id: nextId(), $type: 'NINA.Sequencer.Conditions.LoopCondition, NINA.Sequencer', CompletedIterations: 0, Iterations: frameCount, Parent: ref(id) },
    ];
    const items = [];
    if (filterName && filterName !== 'No Filter (Clear)') items.push(ninaSwitchFilter(id, filterName));
    items.push(ninaTakeExposure(id, exposureSeconds));
    return finishContainer(id, 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer', loopName, parentId, conditions, items, []);
  }

  function buildTargetImagingInstructions(parentId) {
    const id = nextId();
    return finishContainer(id, 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer', 'Target Imaging Instructions', parentId, [], [buildFilterLoop(id)], []);
  }

  function buildDeepSkyObjectContainer(parentId) {
    const id = nextId();
    const ra = raHoursToNinaFields(target.raHours);
    const dec = decDegToNinaFields(target.decDeg);
    const targetObj = {
      $id: nextId(),
      $type: 'NINA.Astrometry.InputTarget, NINA.Astrometry',
      Expanded: true,
      TargetName: target.targetName,
      PositionAngle: 0,
      InputCoordinates: coordinatesNode(ra, dec),
    };

    const items = [ninaCenterAndRotate(id, coordinatesNode(ra, dec)), ninaSetPerihelionTrackingRate(id)];
    if (target.guiding) {
      items.push(ninaStartGuiding(id));
      items.push(ninaSetPerihelionGuiderShiftRate(id));
    }
    items.push(buildTargetImagingInstructions(id));

    return {
      $id: id,
      $type: 'NINA.Sequencer.Container.DeepSkyObjectContainer, NINA.Sequencer',
      Target: targetObj,
      ExposureInfoListExpanded: false,
      ExposureInfoList: {
        $id: nextId(),
        $type: 'NINA.Core.Utility.AsyncObservableCollection`1[[NINA.Sequencer.Utility.ExposureInfo, NINA.Sequencer]], NINA.Core',
        $values: [],
      },
      Strategy: SEQUENTIAL_STRATEGY,
      Name: target.targetName,
      Conditions: conditionsColl([]),
      IsExpanded: true,
      Items: itemsColl(items),
      Triggers: triggersColl([]),
      Parent: ref(parentId),
      ErrorBehavior: 0,
      Attempts: 1,
    };
  }

  const rootId = nextId();

  const startId = nextId();
  const startContainer = finishContainer(startId, 'NINA.Sequencer.Container.StartAreaContainer, NINA.Sequencer', 'Start', rootId, [], [ninaUnparkScope(startId)], []);

  const targetAreaId = nextId();
  const targetAreaContainer = finishContainer(targetAreaId, 'NINA.Sequencer.Container.TargetAreaContainer, NINA.Sequencer', 'Targets', rootId, [], [buildDeepSkyObjectContainer(targetAreaId)], []);

  const endId = nextId();
  const endContainer = finishContainer(endId, 'NINA.Sequencer.Container.EndAreaContainer, NINA.Sequencer', 'End', rootId, [], [], []);

  return finishContainer(rootId, 'NINA.Sequencer.Container.SequenceRootContainer, NINA.Sequencer', `Perihelion - ${target.targetName}`, null, [], [startContainer, targetAreaContainer, endContainer], []);
}
