import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

// Action templates organized by container type
const actionTemplates = {
  start: [
    {
      id: 'unpark-scope',
      name: 'Unpark Telescope',
      icon: 'telescope',
      description: 'Unpark the telescope mount',
      parameters: {},
      color: 'bg-blue-500',
    },
    {
      id: 'cool-camera',
      name: 'Cool Camera',
      icon: 'snowflake',
      description: 'Cool the camera to specified temperature',
      parameters: {
        temperature: {
          type: 'number',
          default: -10,
          min: -50,
          max: 30,
          step: 0.1,
          allowNegative: true,
          label: 'Temperature (°C)',
          tooltip: 'Target temperature for camera cooling',
        },
        duration: {
          type: 'number',
          default: 10,
          min: 0,
          max: 60,
          step: 1,
          label: 'Cooling Duration (minutes)',
          tooltip: 'Time to actively cool the camera (0 = cool until temperature reached)',
        },
      },
      color: 'bg-cyan-500',
    },
    {
      id: 'dew-heater',
      name: 'Dew Heater',
      icon: 'fire',
      description: 'Set camera dew heater state',
      parameters: {
        onOff: {
          type: 'boolean',
          default: false,
          label: 'Enabled',
          tooltip: 'Turn the camera dew heater on or off',
        },
      },
      color: 'bg-teal-500',
    },
  ],
  target: [
    {
      id: 'target-settings',
      name: 'Target Settings',
      icon: 'crosshairs',
      description: 'Define target coordinates and settings',
      parameters: {
        targetName: {
          type: 'text',
          default: 'M31 - Andromeda Galaxy',
          label: 'Target Name',
          tooltip: 'Name of the celestial object',
        },
        ra: {
          type: 'text',
          default: '00:42:44',
          label: 'Right Ascension',
          tooltip: 'RA in HH:MM:SS format',
        },
        dec: {
          type: 'text',
          default: '+41:16:07',
          label: 'Declination',
          tooltip: 'Dec in DD:MM:SS format',
        },
        positionAngle: {
          type: 'number',
          default: 0,
          min: -360,
          max: 360,
          step: 0.1,
          label: 'Position Angle (°)',
          tooltip: 'Camera rotation angle',
        },
      },
      color: 'bg-purple-500',
    },
    {
      id: 'orbital-target',
      name: 'Orbital Object Target',
      icon: 'comet',
      description: 'Target a comet, asteroid or minor planet by orbital elements',
      parameters: {
        targetName: {
          type: 'text',
          default: '',
          label: 'Object Name',
          tooltip: 'Name of the orbital object',
        },
        ra: {
          type: 'text',
          default: '00:00:00',
          label: 'Right Ascension (computed)',
          tooltip: 'RA computed from orbital elements at selection time',
        },
        dec: {
          type: 'text',
          default: '+00:00:00',
          label: 'Declination (computed)',
          tooltip: 'Dec computed from orbital elements at selection time',
        },
        positionAngle: {
          type: 'number',
          default: 0,
          min: -360,
          max: 360,
          step: 0.1,
          label: 'Position Angle (°)',
          tooltip: 'Camera rotation angle',
        },
      },
      color: 'bg-amber-500',
    },
    {
      id: 'slew-to-target',
      name: 'Slew to Target',
      icon: 'cursor-arrow-rays',
      description: 'Navigate to target with different options',
      parameters: {
        slewMode: {
          type: 'select',
          options: ['Slew Only', 'Slew and Center', 'Slew, Center and Rotate'],
          default: 'Slew and Center',
          label: 'Slew Mode',
          tooltip: 'Choose how to navigate to the target',
        },
      },
      color: 'bg-indigo-500',
    },
    {
      id: 'run-autofocus',
      name: 'Run Autofocus',
      icon: 'EyeIcon',
      description: 'Perform automatic focusing routine',
      parameters: {},
      color: 'bg-yellow-500',
    },
    {
      id: 'start-guiding',
      name: 'Start Guiding',
      icon: 'guider',
      description: 'Start autoguiding system',
      parameters: {
        forceCalibration: {
          type: 'boolean',
          default: false,
          label: 'Force Calibration',
          tooltip: 'Force new guider calibration',
        },
      },
      color: 'bg-red-500',
    },
    {
      id: 'smart-exposure',
      name: 'Smart Exposure (Imaging)',
      icon: 'CameraIcon',
      description: 'Intelligent exposure sequence with dithering and triggers',
      parameters: {
        exposureTime: {
          type: 'number',
          default: 120,
          min: 0,
          max: 3600,
          step: 0.1,
          label: 'Exposure Time (s)',
          tooltip: 'Duration of each exposure',
        },
        gain: {
          type: 'number',
          default: 100,
          label: 'Gain',
          tooltip: 'Camera gain setting',
        },
        offset: {
          type: 'number',
          default: -1,
          min: 0,
          max: 1000,
          label: 'Offset',
          tooltip: 'Camera offset setting',
        },
        binning: {
          type: 'select',
          options: ['1x1', '2x2', '3x3', '4x4'],
          default: '1x1',
          label: 'Binning',
          tooltip: 'Pixel binning mode',
        },
        filter: {
          type: 'select',
          options: [],
          default: 'None',
          label: 'Filter',
          tooltip: 'Filter wheel selection',
        },
        imageType: {
          type: 'select',
          options: ['LIGHT', 'DARK', 'FLAT', 'BIAS', 'SNAPSHOT'],
          default: 'LIGHT',
          label: 'Image Type',
          tooltip: 'Type of exposure to capture',
        },
        count: {
          type: 'number',
          default: 100,
          min: 1,
          max: 10000,
          label: 'Image Count',
          tooltip: 'Number of exposures to take',
        },
        ditherAfter: {
          type: 'number',
          default: 0,
          min: 0,
          max: 20,
          label: 'Dither After N Exposures',
          tooltip: 'Dither frequency (0 = no dithering)',
        },
      },
      color: 'bg-green-500',
    },
    {
      id: 'stop-guiding',
      name: 'Stop Guiding',
      icon: 'guider',
      description: 'Stop autoguiding system',
      parameters: {},
      color: 'bg-red-600',
    },
  ],
  end: [
    {
      id: 'stop-guiding',
      name: 'Stop Guiding',
      icon: 'guider',
      description: 'Stop autoguiding system',
      parameters: {},
      color: 'bg-red-600',
    },
    {
      id: 'warm-camera',
      name: 'Warm Camera',
      icon: 'fire',
      description: 'Warm up the camera',
      parameters: {
        duration: {
          type: 'number',
          default: 10,
          min: 0,
          max: 60,
          step: 1,
          label: 'Warming Duration (minutes)',
          tooltip: 'Time to actively warm up the camera (0 = warm to ambient temperature)',
        },
      },
      color: 'bg-orange-500',
    },
    {
      id: 'find-home',
      name: 'Find Home',
      icon: 'home',
      description: 'Move telescope to home position',
      parameters: {},
      color: 'bg-blue-600',
    },
    {
      id: 'park-scope',
      name: 'Park Telescope',
      icon: 'telescope',
      description: 'Park the telescope mount',
      parameters: {},
      color: 'bg-blue-500',
    },
  ],
};

export const useSequenceStore = defineStore('sequence', () => {
  // State - three separate containers
  const startSequence = ref([]);
  const targetSequence = ref([]);
  const endSequence = ref([]);

  const history = ref([]);
  const historyIndex = ref(-1);
  const selectedAction = ref(null);
  const isModified = ref(false);

  // Global sequence settings
  const enableMeridianFlip = ref(true);

  // Localized templates storage
  const localizedActionTemplates = ref(null);

  // Function to initialize localized templates
  function initializeLocalizedTemplates(t) {
    localizedActionTemplates.value = {
      start: [
        {
          id: 'unpark-scope',
          name: t('plugins.sequenceCreator.actions.unparkTelescope.name'),
          icon: 'telescope',
          description: t('plugins.sequenceCreator.actions.unparkTelescope.description'),
          parameters: {},
          color: 'bg-blue-500',
        },
        {
          id: 'cool-camera',
          name: t('plugins.sequenceCreator.actions.coolCamera.name'),
          icon: 'snowflake',
          description: t('plugins.sequenceCreator.actions.coolCamera.description'),
          parameters: {
            temperature: {
              type: 'number',
              default: -10,
              min: -50,
              max: 30,
              step: 0.1,
              allowNegative: true,
              label: t('plugins.sequenceCreator.actions.coolCamera.temperatureLabel'),
              tooltip: t('plugins.sequenceCreator.actions.coolCamera.temperatureTooltip'),
            },
            duration: {
              type: 'number',
              default: 10,
              min: 0,
              max: 60,
              step: 1,
              label: t('plugins.sequenceCreator.actions.coolCamera.durationLabel'),
              tooltip: t('plugins.sequenceCreator.actions.coolCamera.durationTooltip'),
            },
          },
          color: 'bg-cyan-500',
        },
        {
          id: 'dew-heater',
          name: t('plugins.sequenceCreator.actions.dewHeater.name'),
          icon: 'fire',
          description: t('plugins.sequenceCreator.actions.dewHeater.description'),
          parameters: {
            onOff: {
              type: 'boolean',
              default: false,
              label: t('plugins.sequenceCreator.actions.dewHeater.onOffLabel'),
              tooltip: t('plugins.sequenceCreator.actions.dewHeater.onOffTooltip'),
            },
          },
          color: 'bg-teal-500',
        },
      ],
      target: [
        {
          id: 'target-settings',
          name: t('plugins.sequenceCreator.actions.targetSettings.name'),
          icon: 'crosshairs',
          description: t('plugins.sequenceCreator.actions.targetSettings.description'),
          parameters: {
            targetName: {
              type: 'text',
              default: 'M31 - Andromeda Galaxy',
              label: t('plugins.sequenceCreator.actions.targetSettings.targetNameLabel'),
              tooltip: t('plugins.sequenceCreator.actions.targetSettings.targetNameTooltip'),
            },
            ra: {
              type: 'text',
              default: '00:42:44',
              label: t('plugins.sequenceCreator.actions.targetSettings.raLabel'),
              tooltip: t('plugins.sequenceCreator.actions.targetSettings.raTooltip'),
            },
            dec: {
              type: 'text',
              default: '+41:16:07',
              label: t('plugins.sequenceCreator.actions.targetSettings.decLabel'),
              tooltip: t('plugins.sequenceCreator.actions.targetSettings.decTooltip'),
            },
            positionAngle: {
              type: 'number',
              default: 0,
              min: -180,
              max: 180,
              step: 0.1,
              label: t('plugins.sequenceCreator.actions.targetSettings.positionAngleLabel'),
              tooltip: t('plugins.sequenceCreator.actions.targetSettings.positionAngleTooltip'),
            },
          },
          color: 'bg-purple-500',
        },
        {
          id: 'orbital-target',
          name: 'Orbital Object Target',
          icon: 'comet',
          description: 'Target a comet, asteroid or minor planet by orbital elements',
          parameters: {
            targetName: {
              type: 'text',
              default: '',
              label: 'Object Name',
              tooltip: 'Name of the orbital object',
            },
            ra: {
              type: 'text',
              default: '00:00:00',
              label: 'Right Ascension (computed)',
              tooltip: 'RA computed from orbital elements at selection time',
            },
            dec: {
              type: 'text',
              default: '+00:00:00',
              label: 'Declination (computed)',
              tooltip: 'Dec computed from orbital elements at selection time',
            },
            positionAngle: {
              type: 'number',
              default: 0,
              min: -360,
              max: 360,
              step: 0.1,
              label: 'Position Angle (°)',
              tooltip: 'Camera rotation angle',
            },
          },
          color: 'bg-amber-500',
        },
        {
          id: 'slew-to-target',
          name: t('plugins.sequenceCreator.actions.slewToTarget.name'),
          icon: 'cursor-arrow-rays',
          description: t('plugins.sequenceCreator.actions.slewToTarget.description'),
          parameters: {
            slewMode: {
              type: 'select',
              options: ['Slew Only', 'Slew and Center', 'Slew, Center and Rotate'],
              default: 'Slew and Center',
              label: t('plugins.sequenceCreator.actions.slewToTarget.slewModeLabel'),
              tooltip: t('plugins.sequenceCreator.actions.slewToTarget.slewModeTooltip'),
            },
          },
          color: 'bg-indigo-500',
        },
        {
          id: 'run-autofocus',
          name: t('plugins.sequenceCreator.actions.runAutofocus.name'),
          icon: 'EyeIcon',
          description: t('plugins.sequenceCreator.actions.runAutofocus.description'),
          parameters: {},
          color: 'bg-yellow-500',
        },
        {
          id: 'start-guiding',
          name: t('plugins.sequenceCreator.actions.startGuiding.name'),
          icon: 'guider',
          description: t('plugins.sequenceCreator.actions.startGuiding.description'),
          parameters: {
            forceCalibration: {
              type: 'boolean',
              default: false,
              label: t('plugins.sequenceCreator.actions.startGuiding.forceCalibrationLabel'),
              tooltip: t('plugins.sequenceCreator.actions.startGuiding.forceCalibrationTooltip'),
            },
          },
          color: 'bg-red-500',
        },
        {
          id: 'smart-exposure',
          name: t('plugins.sequenceCreator.actions.smartExposure.name'),
          icon: 'CameraIcon',
          description: t('plugins.sequenceCreator.actions.smartExposure.description'),
          parameters: {
            exposureTime: {
              type: 'number',
              default: 120,
              min: 0.1,
              max: 3600,
              step: 0.1,
              label: t('plugins.sequenceCreator.actions.smartExposure.exposureTimeLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.exposureTimeTooltip'),
            },
            gain: {
              type: 'number',
              default: 100,
              min: 0,
              max: 500,
              label: t('plugins.sequenceCreator.actions.smartExposure.gainLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.gainTooltip'),
            },
            offset: {
              type: 'number',
              default: -1,
              min: -100,
              max: 100,
              label: t('plugins.sequenceCreator.actions.smartExposure.offsetLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.offsetTooltip'),
            },
            binning: {
              type: 'select',
              options: ['1x1', '2x2', '3x3', '4x4'],
              default: '1x1',
              label: t('plugins.sequenceCreator.actions.smartExposure.binningLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.binningTooltip'),
            },
            filter: {
              type: 'select',
              options: [], // Will be populated dynamically from filterInfo
              default: 'None',
              label: t('plugins.sequenceCreator.actions.smartExposure.filterLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.filterTooltip'),
            },
            imageType: {
              type: 'select',
              options: ['LIGHT', 'DARK', 'FLAT', 'BIAS', 'SNAPSHOT'],
              default: 'LIGHT',
              label: t('plugins.sequenceCreator.actions.smartExposure.imageTypeLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.imageTypeTooltip'),
            },
            count: {
              type: 'number',
              default: 100,
              min: 1,
              max: 1000,
              label: t('plugins.sequenceCreator.actions.smartExposure.countLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.countTooltip'),
            },
            ditherAfter: {
              type: 'number',
              default: 4,
              min: 0,
              max: 20,
              label: t('plugins.sequenceCreator.actions.smartExposure.ditherAfterLabel'),
              tooltip: t('plugins.sequenceCreator.actions.smartExposure.ditherAfterTooltip'),
            },
          },
          color: 'bg-green-500',
        },
        {
          id: 'stop-guiding',
          name: t('plugins.sequenceCreator.actions.stopGuiding.name'),
          icon: 'guider',
          description: t('plugins.sequenceCreator.actions.stopGuiding.description'),
          parameters: {},
          color: 'bg-red-600',
        },
      ],
      end: [
        {
          id: 'stop-guiding',
          name: t('plugins.sequenceCreator.actions.stopGuiding.name'),
          icon: 'guider',
          description: t('plugins.sequenceCreator.actions.stopGuiding.description'),
          parameters: {},
          color: 'bg-red-600',
        },
        {
          id: 'warm-camera',
          name: t('plugins.sequenceCreator.actions.warmCamera.name'),
          icon: 'fire',
          description: t('plugins.sequenceCreator.actions.warmCamera.description'),
          parameters: {
            duration: {
              type: 'number',
              default: 10,
              min: 0,
              max: 60,
              step: 1,
              label: t('plugins.sequenceCreator.actions.warmCamera.durationLabel'),
              tooltip: t('plugins.sequenceCreator.actions.warmCamera.durationTooltip'),
            },
          },
          color: 'bg-orange-500',
        },
        {
          id: 'find-home',
          name: t('plugins.sequenceCreator.actions.findHome.name'),
          icon: 'home',
          description: t('plugins.sequenceCreator.actions.findHome.description'),
          parameters: {},
          color: 'bg-blue-600',
        },
        {
          id: 'park-scope',
          name: t('plugins.sequenceCreator.actions.parkTelescope.name'),
          icon: 'telescope',
          description: t('plugins.sequenceCreator.actions.parkTelescope.description'),
          parameters: {},
          color: 'bg-blue-500',
        },
      ],
    };
  }

  // Computed
  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.value.length - 1);

  const sequenceIsValid = computed(() => {
    // At minimum, we need target settings and at least one smart exposure in target container
    const hasTargetSettings = targetSequence.value.some(
      (action) => action.type === 'target-settings' || action.type === 'orbital-target'
    );
    const hasSmartExposure = targetSequence.value.some(
      (action) => action.type === 'smart-exposure'
    );
    return hasTargetSettings && hasSmartExposure;
  });

  const ninaSequenceJSON = computed(() => {
    let idCounter = 1;

    const generateId = () => String(idCounter++);

    // Create N.I.N.A sequence structure exactly matching basic.json format
    const sequence = {
      $id: generateId(),
      $type: 'NINA.Sequencer.Container.SequenceRootContainer, NINA.Sequencer',
      Strategy: {
        $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
      },
      Name: 'Sequenz',
      Conditions: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      IsExpanded: true,
      Items: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      Triggers: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      Parent: null,
      ErrorBehavior: 0,
      Attempts: 1,
    };

    // Add Start Area Container (with nested structure like basic.json)
    const startContainer = createBasicStartContainer(startSequence.value, generateId);
    sequence.Items.$values.push(startContainer);

    // Add Target Area Containers - one for each target
    if (targetSequence.value.length > 0) {
      const targetContainers = createBasicTargetContainers(targetSequence.value, generateId);
      targetContainers.forEach((container) => {
        sequence.Items.$values.push(container);
      });
    }

    // Add End Area Container (with nested structure like basic.json)
    const endContainer = createBasicEndContainer(endSequence.value, generateId);
    sequence.Items.$values.push(endContainer);

    // Add Meridian Flip Trigger at root level if enabled (matching seqKomp.json structure)
    if (enableMeridianFlip.value) {
      sequence.Triggers.$values.push({
        $id: generateId(),
        $type: 'NINA.Sequencer.Trigger.MeridianFlip.MeridianFlipTrigger, NINA.Sequencer',
        Parent: { $ref: '1' },
        TriggerRunner: {
          $id: generateId(),
          $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
          Strategy: {
            $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
          },
          Name: null,
          Conditions: {
            $id: generateId(),
            $type:
              'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
            $values: [],
          },
          IsExpanded: true,
          Items: {
            $id: generateId(),
            $type:
              'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
            $values: [],
          },
          Triggers: {
            $id: generateId(),
            $type:
              'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
            $values: [],
          },
          Parent: null,
          ErrorBehavior: 0,
          Attempts: 1,
        },
      });
    }

    return JSON.stringify(sequence, null, 2);
  });

  // Helper function to create basic start container (matches basic.json structure)
  function createBasicStartContainer(actions, generateId) {
    const startId = generateId();
    const basicSequenceStartId = generateId();
    const equipmentCheckId = generateId();

    return {
      $id: startId,
      $type: 'NINA.Sequencer.Container.StartAreaContainer, NINA.Sequencer',
      Strategy: {
        $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
      },
      Name: 'Start',
      Conditions: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      IsExpanded: true,
      Items: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
        $values: [
          {
            $id: basicSequenceStartId,
            $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
            Strategy: {
              $type:
                'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
            },
            Name: 'BASIC SEQUENCE START',
            Conditions: {
              $id: generateId(),
              $type:
                'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
              $values: [],
            },
            IsExpanded: true,
            Items: {
              $id: generateId(),
              $type:
                'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
              $values: [
                {
                  $id: equipmentCheckId,
                  $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
                  Strategy: {
                    $type:
                      'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
                  },
                  Name: 'EQUIPMENT_CHECK',
                  Conditions: {
                    $id: generateId(),
                    $type:
                      'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
                    $values: [],
                  },
                  IsExpanded: true,
                  Items: {
                    $id: generateId(),
                    $type:
                      'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
                    $values: actions.map((action) =>
                      convertActionToNina(action, generateId, equipmentCheckId)
                    ),
                  },
                  Triggers: {
                    $id: generateId(),
                    $type:
                      'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
                    $values: [],
                  },
                  Parent: { $ref: basicSequenceStartId },
                  ErrorBehavior: 0,
                  Attempts: 1,
                },
              ],
            },
            Triggers: {
              $id: generateId(),
              $type:
                'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
              $values: [],
            },
            Parent: { $ref: startId },
            ErrorBehavior: 0,
            Attempts: 1,
          },
        ],
      },
      Triggers: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      Parent: { $ref: '1' },
      ErrorBehavior: 0,
      Attempts: 1,
    };
  }

  // Helper function to create basic target containers - one TargetAreaContainer per target
  function createBasicTargetContainers(actions, generateId) {
    // Group actions by target-settings - each target-settings starts a new target
    const targetGroups = [];
    let currentGroup = [];

    actions.forEach((action) => {
      if ((action.type === 'target-settings' || action.type === 'orbital-target') && currentGroup.length > 0) {
        // Start new group
        targetGroups.push(currentGroup);
        currentGroup = [action];
      } else {
        currentGroup.push(action);
      }
    });

    // Add the last group
    if (currentGroup.length > 0) {
      targetGroups.push(currentGroup);
    }

    // Create separate TargetAreaContainer for each target group
    return targetGroups.map((groupActions) => {
      const targetAreaId = generateId();

      return {
        $id: targetAreaId,
        $type: 'NINA.Sequencer.Container.TargetAreaContainer, NINA.Sequencer',
        Strategy: {
          $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
        },
        Name: 'Targets',
        Conditions: {
          $id: generateId(),
          $type:
            'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
          $values: [],
        },
        IsExpanded: true,
        Items: {
          $id: generateId(),
          $type:
            'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
          $values: [createTargetSequenceContainer(groupActions, generateId, targetAreaId)],
        },
        Triggers: {
          $id: generateId(),
          $type:
            'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
          $values: [],
        },
        Parent: { $ref: '1' },
        ErrorBehavior: 0,
        Attempts: 1,
      };
    });
  }

  // Helper function to create basic end container (matches basic.json structure)
  function createBasicEndContainer(actions, generateId) {
    const endId = generateId();
    const basicSequenceEndId = generateId();
    const endInstructionsId = generateId();

    return {
      $id: endId,
      $type: 'NINA.Sequencer.Container.EndAreaContainer, NINA.Sequencer',
      Strategy: {
        $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
      },
      Name: 'End',
      Conditions: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      IsExpanded: true,
      Items: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
        $values: [
          {
            $id: basicSequenceEndId,
            $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
            Strategy: {
              $type:
                'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
            },
            Name: 'BASIC SEQUENCE END',
            Conditions: {
              $id: generateId(),
              $type:
                'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
              $values: [],
            },
            IsExpanded: true,
            Items: {
              $id: generateId(),
              $type:
                'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
              $values: [
                {
                  $id: endInstructionsId,
                  $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
                  Strategy: {
                    $type:
                      'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
                  },
                  Name: 'END_INSTRUCTIONS',
                  Conditions: {
                    $id: generateId(),
                    $type:
                      'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
                    $values: [],
                  },
                  IsExpanded: true,
                  Items: {
                    $id: generateId(),
                    $type:
                      'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
                    $values: actions.map((action) =>
                      convertActionToNina(action, generateId, endInstructionsId)
                    ),
                  },
                  Triggers: {
                    $id: generateId(),
                    $type:
                      'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
                    $values: [],
                  },
                  Parent: { $ref: basicSequenceEndId },
                  ErrorBehavior: 0,
                  Attempts: 1,
                },
              ],
            },
            Triggers: {
              $id: generateId(),
              $type:
                'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
              $values: [],
            },
            Parent: { $ref: endId },
            ErrorBehavior: 0,
            Attempts: 1,
          },
        ],
      },
      Triggers: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      Parent: { $ref: '1' },
      ErrorBehavior: 0,
      Attempts: 1,
    };
  }

  // Helper function to create target sequence container for a specific target
  function createTargetSequenceContainer(actions, generateId, parentId) {
    const dsoContainerId = generateId();

    // Find target-settings or orbital-target action to extract coordinates
    const targetSettingsAction = actions.find(
      (action) => action.type === 'target-settings' || action.type === 'orbital-target'
    );

    // Parse RA and Dec coordinates from target-settings / orbital-target
    let raHours = 0,
      raMinutes = 0,
      raSeconds = 0.0;
    let negativeDecFlag = false,
      decDegrees = 0,
      decMinutes = 0,
      decSeconds = 0.0;
    let targetName = 'Target';
    let positionAngle = 0.0;

    if (targetSettingsAction && targetSettingsAction.parameters) {
      // Extract target name
      if (targetSettingsAction.parameters.targetName?.value) {
        targetName = targetSettingsAction.parameters.targetName.value;
      }

      // Extract position angle
      if (targetSettingsAction.parameters.positionAngle?.value !== undefined) {
        positionAngle = targetSettingsAction.parameters.positionAngle.value;
      }

      // Parse RA (HH:MM:SS format)
      if (targetSettingsAction.parameters.ra?.value) {
        const raString = targetSettingsAction.parameters.ra.value.toString();
        const raParts = raString.split(':');
        if (raParts.length >= 1) raHours = parseInt(raParts[0]) || 0;
        if (raParts.length >= 2) raMinutes = parseInt(raParts[1]) || 0;
        if (raParts.length >= 3) raSeconds = parseFloat(raParts[2]) || 0.0;
      }

      // Parse Dec (±DD:MM:SS format)
      if (targetSettingsAction.parameters.dec?.value) {
        const decString = targetSettingsAction.parameters.dec.value.toString();
        negativeDecFlag = decString.startsWith('-');
        const cleanDecString = decString.replace(/^[+-]/, '');
        const decParts = cleanDecString.split(':');
        if (decParts.length >= 1) decDegrees = parseInt(decParts[0]) || 0;
        if (decParts.length >= 2) decMinutes = parseInt(decParts[1]) || 0;
        if (decParts.length >= 3) decSeconds = parseFloat(decParts[2]) || 0.0;
      }
    }

    return createBasicDeepSkyObjectContainer(actions, generateId, dsoContainerId, parentId, {
      targetName,
      raHours,
      raMinutes,
      raSeconds,
      negativeDecFlag,
      decDegrees,
      decMinutes,
      decSeconds,
      positionAngle,
    });
  }

  function createBasicDeepSkyObjectContainer(
    actions,
    generateId,
    dsoContainerId,
    parentId,
    targetData = null
  ) {
    const targetImagingId = generateId();

    // Use provided targetData or fallback to parsing from actions
    let raHours = 0,
      raMinutes = 0,
      raSeconds = 0.0;
    let negativeDecFlag = false,
      decDegrees = 0,
      decMinutes = 0,
      decSeconds = 0.0;
    let targetName = 'Target';
    let positionAngle = 0.0;

    if (targetData) {
      // Use provided target data
      targetName = targetData.targetName;
      raHours = targetData.raHours;
      raMinutes = targetData.raMinutes;
      raSeconds = targetData.raSeconds;
      negativeDecFlag = targetData.negativeDecFlag;
      decDegrees = targetData.decDegrees;
      decMinutes = targetData.decMinutes;
      decSeconds = targetData.decSeconds;
      positionAngle = targetData.positionAngle;
    } else {
      // Fallback to parsing from actions (legacy support)
      const targetSettingsAction = actions.find(
        (action) => action.type === 'target-settings' || action.type === 'orbital-target'
      );
      if (targetSettingsAction && targetSettingsAction.parameters) {
        if (targetSettingsAction.parameters.targetName?.value) {
          targetName = targetSettingsAction.parameters.targetName.value;
        }
        if (targetSettingsAction.parameters.positionAngle?.value !== undefined) {
          positionAngle = targetSettingsAction.parameters.positionAngle.value;
        }
        if (targetSettingsAction.parameters.ra?.value) {
          const raString = targetSettingsAction.parameters.ra.value.toString();
          const raParts = raString.split(':');
          if (raParts.length >= 1) raHours = parseInt(raParts[0]) || 0;
          if (raParts.length >= 2) raMinutes = parseInt(raParts[1]) || 0;
          if (raParts.length >= 3) raSeconds = parseFloat(raParts[2]) || 0.0;
        }
        if (targetSettingsAction.parameters.dec?.value) {
          const decString = targetSettingsAction.parameters.dec.value.toString();
          negativeDecFlag = decString.startsWith('-');
          const cleanDecString = decString.replace(/^[+-]/, '');
          const decParts = cleanDecString.split(':');
          if (decParts.length >= 1) decDegrees = parseInt(decParts[0]) || 0;
          if (decParts.length >= 2) decMinutes = parseInt(decParts[1]) || 0;
          if (decParts.length >= 3) decSeconds = parseFloat(decParts[2]) || 0.0;
        }
      }
    }

    const dsoContainer = {
      $id: dsoContainerId,
      $type: 'NINA.Sequencer.Container.DeepSkyObjectContainer, NINA.Sequencer',
      Target: {
        $id: generateId(),
        $type: 'NINA.Astrometry.InputTarget, NINA.Astrometry',
        Expanded: true,
        TargetName: targetName,
        PositionAngle: positionAngle,
        InputCoordinates: {
          $id: generateId(),
          $type: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry',
          RAHours: raHours,
          RAMinutes: raMinutes,
          RASeconds: raSeconds,
          NegativeDec: negativeDecFlag,
          DecDegrees: decDegrees,
          DecMinutes: decMinutes,
          DecSeconds: decSeconds,
        },
      },
      ExposureInfoListExpanded: false,
      ExposureInfoList: {
        $id: generateId(),
        $type:
          'NINA.Core.Utility.AsyncObservableCollection`1[[NINA.Sequencer.Utility.ExposureInfo, NINA.Sequencer]], NINA.Core',
        $values: [],
      },
      Strategy: {
        $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
      },
      Name: targetName,
      Conditions: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      IsExpanded: true,
      Items: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      Triggers: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
        $values: [],
      },
      Parent: { $ref: parentId },
      ErrorBehavior: 0,
      Attempts: 1,
    };

    // Process actions for this specific target (EXCLUDE target-settings/orbital-target as already used for coordinates)
    const preSlewActions = actions.filter(
      (action) =>
        action.type !== 'smart-exposure' &&
        action.type !== 'target-settings' &&
        action.type !== 'orbital-target' &&
        action.type !== 'run-autofocus'
    );
    const autofocusActions = actions.filter((action) => action.type === 'run-autofocus');
    const smartExposureActions = actions.filter((action) => action.type === 'smart-exposure');

    // Add pre-slew actions (like slew-to-target, start-guiding, etc.) but NOT autofocus
    preSlewActions.forEach((action) => {
      dsoContainer.Items.$values.push(convertActionToNina(action, generateId, dsoContainerId));
    });

    if (smartExposureActions.length > 0 || autofocusActions.length > 0) {
      const targetImagingContainer = {
        $id: targetImagingId,
        $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
        Strategy: {
          $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
        },
        Name: 'Target imaging instructions',
        Conditions: {
          $id: generateId(),
          $type:
            'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
          $values: [],
        },
        IsExpanded: true,
        Items: {
          $id: generateId(),
          $type:
            'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
          $values: [],
        },
        Triggers: {
          $id: generateId(),
          $type:
            'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
          $values: [],
        },
        Parent: { $ref: dsoContainerId },
        ErrorBehavior: 0,
        Attempts: 1,
      };

      // Build imaging instructions with alternating autofocus and smart exposure
      if (smartExposureActions.length > 0) {
        smartExposureActions.forEach((smartExposureAction, index) => {
          // Add autofocus before each smart exposure (if autofocus actions exist)
          if (autofocusActions.length > 0) {
            const autofocusAction = autofocusActions[index] || autofocusActions[0];
            targetImagingContainer.Items.$values.push(
              convertActionToNina(autofocusAction, generateId, targetImagingId)
            );
          }
          // Add smart exposure
          targetImagingContainer.Items.$values.push(
            createBasicSmartExposureContainer(smartExposureAction, generateId, targetImagingId)
          );
        });
      } else if (autofocusActions.length > 0) {
        // If only autofocus without smart exposure
        autofocusActions.forEach((action) => {
          targetImagingContainer.Items.$values.push(
            convertActionToNina(action, generateId, targetImagingId)
          );
        });
      }

      dsoContainer.Items.$values.push(targetImagingContainer);
    }

    return dsoContainer;
  }

  // Helper function to get filter info from available filters
  function getFilterInfo(filterName) {
    const api = apiStore();

    if (filterName === 'None' || !filterName) {
      return null;
    }

    // Find filter in available filters by name
    const availableFilters = api.filterInfo?.AvailableFilters || [];
    const filterInfo = availableFilters.find((filter) => filter.Name === filterName);

    if (!filterInfo) {
      console.warn(`Filter "${filterName}" not found in available filters`);
      return null;
    }

    return filterInfo;
  }

  function createBasicSmartExposureContainer(action, generateId, parentId) {
    const smartExposureId = generateId();
    const smartExposure = {
      $id: smartExposureId,
      $type: 'NINA.Sequencer.SequenceItem.Imaging.SmartExposure, NINA.Sequencer',
      ErrorBehavior: 0,
      Attempts: 1,
      Strategy: {
        $type: 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
      },
      Name: 'Smart Exposure',
      Conditions: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
        $values: [
          {
            $id: generateId(),
            $type: 'NINA.Sequencer.Conditions.LoopCondition, NINA.Sequencer',
            CompletedIterations: 0,
            Iterations: action.parameters.count?.value || 100,
            Parent: { $ref: smartExposureId },
          },
        ],
      },
      IsExpanded: false,
      Items: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
        $values: [
          {
            $id: generateId(),
            $type: 'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter, NINA.Sequencer',
            Filter: (() => {
              const filterName = action.parameters.filter?.value;
              const filterInfo = getFilterInfo(filterName);

              if (!filterInfo) {
                return null;
              }

              return {
                $id: generateId(),
                $type: 'NINA.Core.Model.Equipment.FilterInfo, NINA.Core',
                _name: filterInfo.Name,
                _focusOffset: filterInfo.FocusOffset || 0,
                _position: filterInfo.Position,
                _autoFocusExposureTime: filterInfo.AutoFocusExposureTime || -1.0,
                _autoFocusFilter: filterInfo.AutoFocusFilter || false,
                FlatWizardFilterSettings: {
                  $id: generateId(),
                  $type: 'NINA.Core.Model.Equipment.FlatWizardFilterSettings, NINA.Core',
                  FlatWizardMode: filterInfo.FlatWizardFilterSettings?.FlatWizardMode || 0,
                  HistogramMeanTarget:
                    filterInfo.FlatWizardFilterSettings?.HistogramMeanTarget || 0.5,
                  HistogramTolerance:
                    filterInfo.FlatWizardFilterSettings?.HistogramTolerance || 0.1,
                  MaxFlatExposureTime:
                    filterInfo.FlatWizardFilterSettings?.MaxFlatExposureTime || 30.0,
                  MinFlatExposureTime:
                    filterInfo.FlatWizardFilterSettings?.MinFlatExposureTime || 0.01,
                  MaxAbsoluteFlatDeviceBrightness:
                    filterInfo.FlatWizardFilterSettings?.MaxAbsoluteFlatDeviceBrightness || 100,
                  MinAbsoluteFlatDeviceBrightness:
                    filterInfo.FlatWizardFilterSettings?.MinAbsoluteFlatDeviceBrightness || 0,
                  Gain: filterInfo.FlatWizardFilterSettings?.Gain || -1,
                  Offset: filterInfo.FlatWizardFilterSettings?.Offset || -1,
                  Binning: {
                    $id: generateId(),
                    $type: 'NINA.Core.Model.Equipment.BinningMode, NINA.Core',
                    X: filterInfo.FlatWizardFilterSettings?.Binning?.X || 1,
                    Y: filterInfo.FlatWizardFilterSettings?.Binning?.Y || 1,
                  },
                },
                _autoFocusBinning: {
                  $id: generateId(),
                  $type: 'NINA.Core.Model.Equipment.BinningMode, NINA.Core',
                  X: filterInfo.AutoFocusBinning?.X || 1,
                  Y: filterInfo.AutoFocusBinning?.Y || 1,
                },
                _autoFocusGain: filterInfo.AutoFocusGain || -1,
                _autoFocusOffset: filterInfo.AutoFocusOffset || -1,
              };
            })(),
            Parent: { $ref: smartExposureId },
            ErrorBehavior: 0,
            Attempts: 1,
          },
          {
            $id: generateId(),
            $type: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure, NINA.Sequencer',
            ExposureTime: action.parameters.exposureTime?.value || 120.0,
            Gain: action.parameters.gain?.value || 100,
            Offset: action.parameters.offset?.value || -1,
            Binning: {
              $id: generateId(),
              $type: 'NINA.Core.Model.Equipment.BinningMode, NINA.Core',
              X: parseInt((action.parameters.binning?.value || '1x1').split('x')[0]) || 1,
              Y: parseInt((action.parameters.binning?.value || '1x1').split('x')[1]) || 1,
            },
            ImageType: action.parameters.imageType?.value || 'LIGHT',
            ExposureCount: 0,
            Parent: { $ref: smartExposureId },
            ErrorBehavior: 0,
            Attempts: 1,
          },
        ],
      },
      Triggers: {
        $id: generateId(),
        $type:
          'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
        $values: (() => {
          const ditherAfter = action.parameters.ditherAfter?.value ?? 0;

          // Always create dither trigger, but set AfterExposures to 0 for no dithering
          const triggerRunnerId = generateId();
          return [
            {
              $id: generateId(),
              $type: 'NINA.Sequencer.Trigger.Guider.DitherAfterExposures, NINA.Sequencer',
              AfterExposures: ditherAfter,
              Parent: { $ref: smartExposureId },
              TriggerRunner: {
                $id: triggerRunnerId,
                $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
                Strategy: {
                  $type:
                    'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer',
                },
                Name: null,
                Conditions: {
                  $id: generateId(),
                  $type:
                    'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Conditions.ISequenceCondition, NINA.Sequencer]], System.ObjectModel',
                  $values: [],
                },
                IsExpanded: true,
                Items: {
                  $id: generateId(),
                  $type:
                    'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.SequenceItem.ISequenceItem, NINA.Sequencer]], System.ObjectModel',
                  $values: [
                    {
                      $id: generateId(),
                      $type: 'NINA.Sequencer.SequenceItem.Guider.Dither, NINA.Sequencer',
                      Parent: { $ref: triggerRunnerId },
                      ErrorBehavior: 0,
                      Attempts: 1,
                    },
                  ],
                },
                Triggers: {
                  $id: generateId(),
                  $type:
                    'System.Collections.ObjectModel.ObservableCollection`1[[NINA.Sequencer.Trigger.ISequenceTrigger, NINA.Sequencer]], System.ObjectModel',
                  $values: [],
                },
                Parent: null,
                ErrorBehavior: 0,
                Attempts: 1,
              },
            },
          ];
        })(),
      },
      Parent: { $ref: parentId },
    };

    return smartExposure;
  }

  // Helper function to convert actions to N.I.N.A format
  function convertActionToNina(action, generateId, parentId = null) {
    const baseItem = {
      $id: generateId(),
      Parent: parentId ? { $ref: parentId } : null,
      ErrorBehavior: 0,
      Attempts: 1,
    };

    // Map action types to N.I.N.A types - slew-to-target and target-settings will be handled specially
    const ninaTypeMap = {
      'unpark-scope': 'NINA.Sequencer.SequenceItem.Telescope.UnparkScope, NINA.Sequencer',
      'park-scope': 'NINA.Sequencer.SequenceItem.Telescope.ParkScope, NINA.Sequencer',
      'find-home': 'NINA.Sequencer.SequenceItem.Telescope.FindHome, NINA.Sequencer',
      'cool-camera': 'NINA.Sequencer.SequenceItem.Camera.CoolCamera, NINA.Sequencer',
      'dew-heater': 'NINA.Sequencer.SequenceItem.Camera.DewHeater, NINA.Sequencer',
      'warm-camera': 'NINA.Sequencer.SequenceItem.Camera.WarmCamera, NINA.Sequencer',
      'run-autofocus': 'NINA.Sequencer.SequenceItem.Autofocus.RunAutofocus, NINA.Sequencer',
      'start-guiding': 'NINA.Sequencer.SequenceItem.Guider.StartGuiding, NINA.Sequencer',
      'stop-guiding': 'NINA.Sequencer.SequenceItem.Guider.StopGuiding, NINA.Sequencer',
    };

    // Determine the N.I.N.A type and properties
    let ninaType;
    let additionalProperties = {};

    // Handle target-settings / orbital-target - convert to SlewScopeToRaDec
    if (action.type === 'target-settings' || action.type === 'orbital-target') {
      ninaType = 'NINA.Sequencer.SequenceItem.Telescope.SlewScopeToRaDec, NINA.Sequencer';
      additionalProperties.Inherited = false;
      additionalProperties.Coordinates = {
        $id: generateId(),
        $type: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry',
        RAHours: action.parameters.ra?.value
          ? parseInt(action.parameters.ra.value.split(':')[0]) || 0
          : 0,
        RAMinutes: action.parameters.ra?.value
          ? parseInt(action.parameters.ra.value.split(':')[1]) || 0
          : 0,
        RASeconds: action.parameters.ra?.value
          ? parseFloat(action.parameters.ra.value.split(':')[2]) || 0.0
          : 0.0,
        NegativeDec: action.parameters.dec?.value
          ? action.parameters.dec.value.startsWith('-')
          : false,
        DecDegrees: action.parameters.dec?.value
          ? parseInt(action.parameters.dec.value.replace(/^[+-]/, '').split(':')[0]) || 0
          : 0,
        DecMinutes: action.parameters.dec?.value
          ? parseInt(action.parameters.dec.value.replace(/^[+-]/, '').split(':')[1]) || 0
          : 0,
        DecSeconds: action.parameters.dec?.value
          ? parseFloat(action.parameters.dec.value.replace(/^[+-]/, '').split(':')[2]) || 0.0
          : 0.0,
      };
    }
    // Handle slew-to-target specially based on slewMode parameter
    else if (action.type === 'slew-to-target') {
      const slewMode = action.parameters.slewMode?.value || 'Slew and Center';

      switch (slewMode) {
        case 'Slew Only':
          ninaType = 'NINA.Sequencer.SequenceItem.Telescope.SlewScopeToRaDec, NINA.Sequencer';
          additionalProperties.Inherited = false;
          additionalProperties.Coordinates = {
            $id: generateId(),
            $type: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry',
            RAHours: 0,
            RAMinutes: 0,
            RASeconds: 0.0,
            NegativeDec: false,
            DecDegrees: 0,
            DecMinutes: 0,
            DecSeconds: 0.0,
          };
          break;
        case 'Slew and Center':
          ninaType = 'NINA.Sequencer.SequenceItem.Platesolving.Center, NINA.Sequencer';
          additionalProperties.Inherited = true;
          additionalProperties.Coordinates = {
            $id: generateId(),
            $type: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry',
            RAHours: 0,
            RAMinutes: 0,
            RASeconds: 0.0,
            NegativeDec: false,
            DecDegrees: 0,
            DecMinutes: 0,
            DecSeconds: 0.0,
          };
          break;
        case 'Slew, Center and Rotate':
          ninaType = 'NINA.Sequencer.SequenceItem.Platesolving.CenterAndRotate, NINA.Sequencer';
          additionalProperties.PositionAngle = 0.0;
          additionalProperties.Inherited = true;
          additionalProperties.Coordinates = {
            $id: generateId(),
            $type: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry',
            RAHours: 0,
            RAMinutes: 0,
            RASeconds: 0.0,
            NegativeDec: false,
            DecDegrees: 0,
            DecMinutes: 0,
            DecSeconds: 0.0,
          };
          break;
      }
    } else {
      ninaType =
        ninaTypeMap[action.type] ||
        'NINA.Sequencer.SequenceItem.Utility.Annotation, NINA.Sequencer';
    }

    const ninaItem = {
      ...baseItem,
      $type: ninaType,
      ...additionalProperties,
    };

    // Add specific properties based on action type
    switch (action.type) {
      case 'target-settings':
      case 'orbital-target':
        // Properties already set above
        break;
      case 'cool-camera':
        ninaItem.Temperature = action.parameters.temperature?.value || -10.0;
        ninaItem.Duration = action.parameters.duration?.value || 0;
        break;
      case 'dew-heater':
        ninaItem.OnOff = action.parameters.onOff?.value || false;
        break;
      case 'warm-camera':
        ninaItem.Duration = action.parameters.duration?.value || 0;
        break;
      case 'slew-to-target':
        // Properties already set above based on slewMode
        break;
      case 'run-autofocus':
        // Run autofocus has no additional parameters
        break;
      case 'find-home':
        // Find home has no additional parameters
        break;
      case 'start-guiding':
        ninaItem.ForceCalibration = action.parameters.forceCalibration?.value || false;
        break;
      case 'stop-guiding':
        // Stop guiding has no additional parameters
        break;
    }

    return ninaItem;
  }

  // Actions
  function addToHistory() {
    // Remove any history after current index
    history.value = history.value.slice(0, historyIndex.value + 1);
    // Add current state
    history.value.push({
      start: JSON.parse(JSON.stringify(startSequence.value)),
      target: JSON.parse(JSON.stringify(targetSequence.value)),
      end: JSON.parse(JSON.stringify(endSequence.value)),
    });
    historyIndex.value = history.value.length - 1;
    // Limit history size
    if (history.value.length > 50) {
      history.value.shift();
      historyIndex.value--;
    }
    isModified.value = true;
  }

  function addAction(template, containerType, index = null) {
    if (!actionTemplates[containerType]) {
      console.error(`Invalid container type: ${containerType}`);
      return null;
    }

    const action = {
      id: uuidv4(),
      type: template.id,
      name: template.name,
      icon: template.icon,
      description: template.description,
      parameters: JSON.parse(JSON.stringify(template.parameters)),
      color: template.color,
      enabled: true,
    };

    // Set default parameter values
    Object.keys(action.parameters).forEach((key) => {
      const param = action.parameters[key];
      if (param.default !== undefined) {
        action.parameters[key].value = param.default;
      }
    });

    // Add to appropriate container
    let targetContainer;
    switch (containerType) {
      case 'start':
        targetContainer = startSequence;
        break;
      case 'target':
        targetContainer = targetSequence;
        break;
      case 'end':
        targetContainer = endSequence;
        break;
      default:
        console.error(`Unknown container type: ${containerType}`);
        return null;
    }

    if (index !== null) {
      targetContainer.value.splice(index, 0, action);
    } else {
      targetContainer.value.push(action);
    }

    addToHistory();
    return action;
  }

  function removeAction(actionId, containerType) {
    let targetContainer;
    switch (containerType) {
      case 'start':
        targetContainer = startSequence;
        break;
      case 'target':
        targetContainer = targetSequence;
        break;
      case 'end':
        targetContainer = endSequence;
        break;
      default:
        return;
    }

    const index = targetContainer.value.findIndex((action) => action.id === actionId);
    if (index !== -1) {
      targetContainer.value.splice(index, 1);
      addToHistory();
    }
  }

  function moveAction(oldIndex, newIndex, containerType) {
    let targetContainer;
    switch (containerType) {
      case 'start':
        targetContainer = startSequence;
        break;
      case 'target':
        targetContainer = targetSequence;
        break;
      case 'end':
        targetContainer = endSequence;
        break;
      default:
        return;
    }

    const action = targetContainer.value[oldIndex];
    targetContainer.value.splice(oldIndex, 1);
    targetContainer.value.splice(newIndex, 0, action);
    addToHistory();
  }

  function duplicateAction(actionId, containerType) {
    let targetContainer;
    switch (containerType) {
      case 'start':
        targetContainer = startSequence;
        break;
      case 'target':
        targetContainer = targetSequence;
        break;
      case 'end':
        targetContainer = endSequence;
        break;
      default:
        return;
    }

    const index = targetContainer.value.findIndex((action) => action.id === actionId);
    if (index !== -1) {
      const original = targetContainer.value[index];
      const duplicate = {
        ...JSON.parse(JSON.stringify(original)),
        id: uuidv4(),
        name: `${original.name} (Copy)`,
      };
      targetContainer.value.splice(index + 1, 0, duplicate);
      addToHistory();
    }
  }

  function updateActionParameter(actionId, parameterKey, value) {
    // Search all containers for the action
    const containers = [startSequence.value, targetSequence.value, endSequence.value];
    for (const container of containers) {
      const action = container.find((action) => action.id === actionId);
      if (action && action.parameters[parameterKey]) {
        action.parameters[parameterKey].value = value;
        isModified.value = true;
        return;
      }
    }
  }

  function updateActionName(actionId, newName) {
    // Search all containers for the action
    const containers = [startSequence.value, targetSequence.value, endSequence.value];
    for (const container of containers) {
      const action = container.find((action) => action.id === actionId);
      if (action) {
        action.name = newName;
        isModified.value = true;
        addToHistory();
        return;
      }
    }
  }

  function clearSequence() {
    startSequence.value = [];
    targetSequence.value = [];
    endSequence.value = [];
    addToHistory();
  }

  function loadSequence(sequenceData) {
    try {
      const parsed = typeof sequenceData === 'string' ? JSON.parse(sequenceData) : sequenceData;
      startSequence.value = parsed.start || [];
      targetSequence.value = parsed.target || [];
      endSequence.value = parsed.end || [];
      addToHistory();
      isModified.value = false;
    } catch (error) {
      console.error('Failed to load sequence:', error);
    }
  }

  async function loadBasicSequence() {
    // Try to load saved default sequence first
    const loaded = await loadDefaultSequence();
    if (loaded) {
      return; // Successfully loaded saved default
    }

    // No saved default exists, load the basic default sequence
    clearSequence();

    // Add basic start actions
    if (actionTemplates.start.find((t) => t.id === 'unpark-scope')) {
      addAction(
        actionTemplates.start.find((t) => t.id === 'unpark-scope'),
        'start'
      );
    }
    if (actionTemplates.start.find((t) => t.id === 'cool-camera')) {
      addAction(
        actionTemplates.start.find((t) => t.id === 'cool-camera'),
        'start'
      );
    }

    // Add basic target actions
    if (actionTemplates.target.find((t) => t.id === 'target-settings')) {
      addAction(
        actionTemplates.target.find((t) => t.id === 'target-settings'),
        'target'
      );
    }
    if (actionTemplates.target.find((t) => t.id === 'slew-to-target')) {
      addAction(
        actionTemplates.target.find((t) => t.id === 'slew-to-target'),
        'target'
      );
    }
    if (actionTemplates.target.find((t) => t.id === 'run-autofocus')) {
      addAction(
        actionTemplates.target.find((t) => t.id === 'run-autofocus'),
        'target'
      );
    }
    if (actionTemplates.target.find((t) => t.id === 'start-guiding')) {
      addAction(
        actionTemplates.target.find((t) => t.id === 'start-guiding'),
        'target'
      );
    }
    if (actionTemplates.target.find((t) => t.id === 'smart-exposure')) {
      addAction(
        actionTemplates.target.find((t) => t.id === 'smart-exposure'),
        'target'
      );
    }

    // Add basic end actions
    if (actionTemplates.end.find((t) => t.id === 'warm-camera')) {
      addAction(
        actionTemplates.end.find((t) => t.id === 'warm-camera'),
        'end'
      );
    }
    if (actionTemplates.end.find((t) => t.id === 'find-home')) {
      addAction(
        actionTemplates.end.find((t) => t.id === 'find-home'),
        'end'
      );
    }
    if (actionTemplates.end.find((t) => t.id === 'park-scope')) {
      addAction(
        actionTemplates.end.find((t) => t.id === 'park-scope'),
        'end'
      );
    }

    isModified.value = false;

    // Save this basic sequence as the initial default in backend
    try {
      await saveAsDefaultSequence();
      console.log('Basic sequence saved as initial default in backend');
    } catch (error) {
      console.error('Error saving initial basic sequence to backend:', error);
    }
  }

  async function saveAsDefaultSequence() {
    try {
      // Save current sequence to backend as default
      const defaultSequence = {
        start: JSON.parse(JSON.stringify(startSequence.value)),
        target: JSON.parse(JSON.stringify(targetSequence.value)),
        end: JSON.parse(JSON.stringify(endSequence.value)),
      };

      await apiService.saveDefaultSequence(defaultSequence);
      console.log('Sequence saved as default to backend');
    } catch (error) {
      console.error('Error saving default sequence to backend:', error);
      throw error;
    }
  }

  async function loadDefaultSequence() {
    // Load default sequence from backend
    try {
      const defaultSequence = await apiService.getDefaultSequence();
      if (defaultSequence) {
        startSequence.value = defaultSequence.start || [];
        targetSequence.value = defaultSequence.target || [];
        endSequence.value = defaultSequence.end || [];
        isModified.value = false;
        console.log('Default sequence loaded from backend');
        return true;
      }
    } catch (error) {
      console.error('Error loading default sequence from backend:', error);
    }
    return false;
  }

  function undo() {
    if (canUndo.value) {
      historyIndex.value--;
      const state = history.value[historyIndex.value];
      startSequence.value = JSON.parse(JSON.stringify(state.start));
      targetSequence.value = JSON.parse(JSON.stringify(state.target));
      endSequence.value = JSON.parse(JSON.stringify(state.end));
    }
  }

  function redo() {
    if (canRedo.value) {
      historyIndex.value++;
      const state = history.value[historyIndex.value];
      startSequence.value = JSON.parse(JSON.stringify(state.start));
      targetSequence.value = JSON.parse(JSON.stringify(state.target));
      endSequence.value = JSON.parse(JSON.stringify(state.end));
    }
  }

  function getActionTemplate(type, containerType) {
    if (!actionTemplates[containerType]) return null;
    return actionTemplates[containerType].find((template) => template.id === type);
  }

  function selectAction(action) {
    selectedAction.value = action;
  }

  function exportSequenceJSON() {
    return ninaSequenceJSON.value;
  }

  function exportSequenceData() {
    return {
      start: startSequence.value,
      target: targetSequence.value,
      end: endSequence.value,
      metadata: {
        created: new Date().toISOString(),
        version: '1.0',
        generator: 'Touch-N-Stars Sequence Creator',
      },
    };
  }

  // Initialize with empty history
  if (history.value.length === 0) {
    addToHistory();
  }

  // ── Named Sequence Library ──────────────────────────────────────────────────

  const savedSequencesList = ref([]);
  const defaultSequenceKey = ref(null);

  function sanitizeName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  }

  async function loadSavedSequencesList() {
    try {
      const all = await apiService.getAllSettings();
      const prefix = 'sequence_creator_saved_';
      savedSequencesList.value = Object.entries(all)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => {
          try {
            const parsed = JSON.parse(value);
            return { key, name: parsed.name, createdAt: parsed.createdAt };
          } catch {
            return { key, name: key.replace(prefix, ''), createdAt: null };
          }
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      // Determine which named sequence is currently the default
      const defaultRaw = all['sequence_creator_default'];
      if (defaultRaw) {
        try {
          const parsed = JSON.parse(defaultRaw);
          defaultSequenceKey.value = parsed.sourceKey || null;
        } catch {
          defaultSequenceKey.value = null;
        }
      } else {
        defaultSequenceKey.value = null;
      }
    } catch (error) {
      console.error('Error loading saved sequences list:', error);
      throw error;
    }
  }

  async function setNamedSequenceAsDefault(key) {
    const response = await apiService.getSetting(key);
    if (!response?.Response?.Value) throw new Error('Sequence not found');
    const data = JSON.parse(response.Response.Value);
    const defaultPayload = {
      start: data.start || [],
      target: data.target || [],
      end: data.end || [],
      sourceKey: key,
    };
    await apiService.saveDefaultSequence(defaultPayload);
    defaultSequenceKey.value = key;
  }

  async function saveNamedSequence(name) {
    const key = 'sequence_creator_saved_' + sanitizeName(name);
    const data = {
      name,
      createdAt: new Date().toISOString(),
      start: JSON.parse(JSON.stringify(startSequence.value)),
      target: JSON.parse(JSON.stringify(targetSequence.value)),
      end: JSON.parse(JSON.stringify(endSequence.value)),
    };
    try {
      await apiService.createSetting({ Key: key, Value: JSON.stringify(data) });
    } catch (err) {
      if (err.response?.status === 409) {
        await apiService.updateSetting(key, JSON.stringify(data));
      } else {
        throw err;
      }
    }
    // If no default is set yet, make this the first default automatically
    if (!defaultSequenceKey.value) {
      await setNamedSequenceAsDefault(key);
    }
  }

  async function loadNamedSequence(key) {
    const response = await apiService.getSetting(key);
    if (response?.Response?.Value) {
      const data = JSON.parse(response.Response.Value);
      startSequence.value = data.start || [];
      targetSequence.value = data.target || [];
      endSequence.value = data.end || [];
      isModified.value = false;
      addToHistory();
    }
  }

  async function deleteNamedSequence(key) {
    await apiService.deleteSetting(key);
    savedSequencesList.value = savedSequencesList.value.filter((s) => s.key !== key);

    // If the deleted sequence was the default, assign a new one
    if (defaultSequenceKey.value === key) {
      defaultSequenceKey.value = null;
      if (savedSequencesList.value.length > 0) {
        await setNamedSequenceAsDefault(savedSequencesList.value[0].key);
      } else {
        // No named sequences left – fall back to saving the current editor state as default
        await saveAsDefaultSequence();
      }
    }
  }

  return {
    // State
    startSequence,
    targetSequence,
    endSequence,
    selectedAction,
    isModified,
    actionTemplates: computed(() => localizedActionTemplates.value || actionTemplates),
    enableMeridianFlip,

    // Computed
    canUndo,
    canRedo,
    sequenceIsValid,
    ninaSequenceJSON,

    // Actions
    addAction,
    removeAction,
    moveAction,
    duplicateAction,
    updateActionParameter,
    updateActionName,
    clearSequence,
    loadSequence,
    loadBasicSequence,
    saveAsDefaultSequence,
    undo,
    redo,
    getActionTemplate,
    selectAction,
    exportSequenceJSON,
    exportSequenceData,
    initializeLocalizedTemplates,
    savedSequencesList,
    defaultSequenceKey,
    loadSavedSequencesList,
    saveNamedSequence,
    loadNamedSequence,
    deleteNamedSequence,
    setNamedSequenceAsDefault,
  };
});
