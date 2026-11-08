// Answers of the Touch'N'Stars plugin's sequence controller (/api/sequence/*) for the browser
// tests. The tree follows the shape a real plugin returns for /sequence/current (a bare array:
// global triggers first, then the Start, Targets and End areas) and carries one item in every
// state the editor draws: finished, running, failed with issues, disabled and nested. The type
// catalogs are a subset of what a PINS host lists. Only reads are answered, so every edit the
// app sends ends up unanswered and a test can assert that none went out.
const SEQ = 'NINA.Sequencer';

function smartExposure(id, { filter, time, iterations, completed, status }) {
  return {
    Id: id,
    Name: 'Smart Exposure',
    FullTypeName: `${SEQ}.SequenceItem.Imaging.SmartExposure`,
    Status: status,
    Items: [
      {
        Id: `${id}-filter`,
        FullTypeName: `${SEQ}.SequenceItem.FilterWheel.SwitchFilter`,
        Status: status,
        ComboBoxText: filter,
      },
      {
        Id: `${id}-exposure`,
        FullTypeName: `${SEQ}.SequenceItem.Imaging.TakeExposure`,
        Status: status,
        ExposureTime: time,
        Gain: 100,
        Offset: 10,
        ImageType: 'LIGHT',
        Binning: { X: 1, Y: 1 },
      },
    ],
    Triggers: [
      {
        Id: `${id}-dither`,
        FullTypeName: `${SEQ}.Trigger.Guider.DitherAfterExposures`,
        Status: 'CREATED',
        AfterExposures: 1,
      },
    ],
    Conditions: [
      {
        Id: `${id}-loop`,
        FullTypeName: `${SEQ}.Conditions.LoopCondition`,
        Status: status,
        Iterations: iterations,
        CompletedIterations: completed,
      },
    ],
  };
}

const TREE = [
  {
    Id: 'global',
    GlobalTriggers: [
      {
        Id: 'meridian-flip',
        Name: 'Meridian Flip',
        FullTypeName: `${SEQ}.Trigger.MeridianFlip.MeridianFlipTrigger`,
        Status: 'CREATED',
        MinutesAfterMeridian: 5,
        MaxMinutesAfterMeridian: 15,
        TimeToMeridianFlip: 2.4,
      },
    ],
  },
  {
    Id: 'start',
    Name: 'Start',
    FullTypeName: `${SEQ}.Container.StartAreaContainer`,
    Status: 'FINISHED',
    Iterations: 0,
    Items: [
      {
        Id: 'cool-camera',
        Name: 'Cool Camera',
        FullTypeName: `${SEQ}.SequenceItem.Camera.CoolCamera`,
        Status: 'FINISHED',
        Temperature: -10,
        Duration: 5,
      },
      {
        Id: 'unpark',
        Name: 'Unpark Scope',
        FullTypeName: `${SEQ}.SequenceItem.Telescope.UnparkScope`,
        Status: 'FINISHED',
      },
    ],
    Triggers: [],
    Conditions: [],
  },
  {
    Id: 'targets',
    Name: 'Targets',
    FullTypeName: `${SEQ}.Container.TargetAreaContainer`,
    Status: 'RUNNING',
    Iterations: 0,
    Items: [
      {
        Id: 'm31',
        Name: 'M 31',
        FullTypeName: `${SEQ}.Container.DeepSkyObjectContainer`,
        Status: 'RUNNING',
        Target: 'RA: 00:42:44; Dec: 41° 16\' 07"; Epoch: J2000; Position Angle: 0',
        Items: [
          {
            Id: 'm31-center',
            Name: 'Slew and center',
            FullTypeName: `${SEQ}.SequenceItem.Platesolving.Center`,
            Status: 'FINISHED',
            Inherited: true,
            Coordinates: { RAHours: 0, RAMinutes: 42, RASeconds: 44, DecDegrees: 41 },
          },
          {
            Id: 'm31-guiding',
            Name: 'Start Guiding',
            FullTypeName: `${SEQ}.SequenceItem.Guider.StartGuiding`,
            Status: 'FINISHED',
            ForceCalibration: false,
          },
          smartExposure('m31-ha', {
            filter: 'Ha',
            time: 300,
            iterations: 20,
            completed: 5,
            status: 'RUNNING',
          }),
          smartExposure('m31-oiii', {
            filter: 'OIII',
            time: 300,
            iterations: 20,
            completed: 0,
            status: 'CREATED',
          }),
          {
            Id: 'm31-note',
            Name: 'Annotation',
            FullTypeName: `${SEQ}.SequenceItem.Utility.Annotation`,
            Status: 'DISABLED',
            Text: 'Check the dew heater before midnight',
          },
          {
            Id: 'm31-calibration',
            Name: 'Calibration frames',
            FullTypeName: `${SEQ}.Container.SequentialContainer`,
            Status: 'CREATED',
            Items: [
              {
                Id: 'm31-calibration-exposure',
                Name: 'Take Exposure',
                FullTypeName: `${SEQ}.SequenceItem.Imaging.TakeExposure`,
                Status: 'FAILED',
                ExposureTime: 1,
                Gain: 100,
                Offset: 10,
                ImageType: 'BIAS',
                Binning: { X: 1, Y: 1 },
                Issues: ['Camera is not connected'],
              },
            ],
            Triggers: [],
            Conditions: [],
          },
        ],
        Triggers: [
          {
            Id: 'm31-autofocus',
            Name: 'Autofocus After Exposures',
            FullTypeName: `${SEQ}.Trigger.Autofocus.AutofocusAfterExposures`,
            Status: 'CREATED',
            AfterExposures: 10,
          },
        ],
        Conditions: [
          {
            Id: 'm31-loop',
            Name: 'Loop For Iterations',
            FullTypeName: `${SEQ}.Conditions.LoopCondition`,
            Status: 'RUNNING',
            Iterations: 1,
            CompletedIterations: 0,
          },
        ],
      },
      {
        Id: 'ngc7000',
        Name: 'NGC 7000',
        FullTypeName: `${SEQ}.Container.DeepSkyObjectContainer`,
        Status: 'CREATED',
        Target: 'RA: 20:59:17; Dec: 44° 31\' 44"; Epoch: J2000; Position Angle: 90',
        Items: [
          smartExposure('ngc7000-ha', {
            filter: 'Ha',
            time: 600,
            iterations: 12,
            completed: 0,
            status: 'CREATED',
          }),
        ],
        Triggers: [],
        Conditions: [],
      },
    ],
    Triggers: [],
    Conditions: [],
  },
  {
    Id: 'end',
    Name: 'End',
    FullTypeName: `${SEQ}.Container.EndAreaContainer`,
    Status: 'CREATED',
    Iterations: 0,
    Items: [
      {
        Id: 'warm-camera',
        Name: 'Warm Camera',
        FullTypeName: `${SEQ}.SequenceItem.Camera.WarmCamera`,
        Status: 'CREATED',
        Duration: 10,
      },
      {
        Id: 'park',
        Name: 'Park Scope',
        FullTypeName: `${SEQ}.SequenceItem.Telescope.ParkScope`,
        Status: 'CREATED',
      },
    ],
    Triggers: [],
    Conditions: [],
  },
];

function statusEntries(items, entries = []) {
  for (const item of items ?? []) {
    if (item.Status) entries.push({ Id: item.Id, Status: item.Status });
    for (const list of [item.Items, item.Triggers, item.Conditions, item.GlobalTriggers]) {
      statusEntries(list, entries);
    }
  }
  return entries;
}

const ITEM_TYPES = [
  [
    '* Instruction Set *',
    'Conditional Instruction Set',
    'NINA.Sequencer.Container.ConditionalContainer',
  ],
  [
    '* Instruction Set *',
    'Deep Sky Object Instruction Set',
    'NINA.Sequencer.Container.DeepSkyObjectContainer',
  ],
  ['Advanced API', 'Send WebSocket Event', 'ninaAPI.SequenceItems.SendEventInstruction'],
  ['Camera', 'Cool Camera', 'NINA.Sequencer.SequenceItem.Camera.CoolCamera'],
  ['Camera', 'Dew Heater', 'NINA.Sequencer.SequenceItem.Camera.DewHeater'],
  ['Connect', 'Connect All Equipment', 'NINA.Sequencer.SequenceItem.Connect.ConnectAllEquipment'],
  ['Connect', 'Connect Equipment', 'NINA.Sequencer.SequenceItem.Connect.ConnectEquipment'],
  ['Dome', 'Close Dome Shutter', 'NINA.Sequencer.SequenceItem.Dome.CloseDomeShutter'],
  ['Dome', 'Disable Dome Sync', 'NINA.Sequencer.SequenceItem.Dome.DisableDomeSynchronization'],
  ['Filter Wheel', 'Switch Filter', 'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter'],
  [
    'Flat Device',
    'Auto Brightness Flat',
    'NINA.Sequencer.SequenceItem.FlatDevice.AutoBrightnessFlat',
  ],
  ['Flat Device', 'Auto Exposure Flat', 'NINA.Sequencer.SequenceItem.FlatDevice.AutoExposureFlat'],
  ['Focuser', 'Move Focuser', 'NINA.Sequencer.SequenceItem.Focuser.MoveFocuserAbsolute'],
  [
    'Focuser',
    'Move Focuser by Temp.',
    'NINA.Sequencer.SequenceItem.Focuser.MoveFocuserByTemperature',
  ],
  ['Ground Station', 'Play Sound', 'DaleGhent.NINA.GroundStation.PlaySound.PlaySound'],
  [
    'Ground Station',
    'Publish to MQTT broker',
    'DaleGhent.NINA.GroundStation.SendToMqtt.SendToMqtt',
  ],
  ['Guider', 'Dither', 'NINA.Sequencer.SequenceItem.Guider.Dither'],
  ['Guider', 'Start Guiding', 'NINA.Sequencer.SequenceItem.Guider.StartGuiding'],
  ['Livestack', 'Stack flats', 'NINA.Plugin.Livestack.Instructions.StackFlats'],
  ['Livestack', 'Start live stacking', 'NINA.Plugin.Livestack.Instructions.StartLivestacking'],
  [
    'Night Summary',
    'Night Summary End',
    'NINA.Plugin.NightSummary.Sequencer.NightSummaryEndInstruction',
  ],
  [
    'Night Summary',
    'Night Summary Start',
    'NINA.Plugin.NightSummary.Sequencer.NightSummaryInstruction',
  ],
  [
    'Phd2 Tools',
    'Change PHD2 Parameters',
    'nina.plugin.phd2tools.Phd2ToolsSequenceItems.ChangePHD2Parameters',
  ],
  [
    'Phd2 Tools',
    'PHD2 Wait for Settle',
    'nina.plugin.phd2tools.Phd2ToolsSequenceItems.Phd2SettleInstruction',
  ],
  [
    'Polar Alignment',
    'Three Point Polar Alignment',
    'NINA.Plugins.PolarAlignment.Instructions.PolarAlignment',
  ],
  [
    'Rotator',
    'Rotate to mechanical angle',
    'NINA.Sequencer.SequenceItem.Rotator.MoveRotatorMechanical',
  ],
  ['Rotator', 'Solve and rotate', 'NINA.Sequencer.SequenceItem.Platesolving.SolveAndRotate'],
  ['Safety Monitor', 'Wait until safe', 'NINA.Sequencer.SequenceItem.SafetyMonitor.WaitUntilSafe'],
  ['Switch', 'Set Switch Value', 'NINA.Sequencer.SequenceItem.Switch.SetSwitchValue'],
  ['Symbols', 'Define Constant', 'NINA.Sequencer.SequenceItem.Expressions.GlobalConstant'],
  ['Symbols', 'Define Scoped Variable', 'NINA.Sequencer.SequenceItem.Expressions.Variable'],
  ['Telescope', 'Find home', 'NINA.Sequencer.SequenceItem.Telescope.FindHome'],
  ['Telescope', 'Park Scope', 'NINA.Sequencer.SequenceItem.Telescope.ParkScope'],
  ["Touch 'N' Stars", 'TNS Message Box', 'TouchNStars.SequenceItems.TNSMessageBox'],
  ['Utility', 'Annotation', 'NINA.Sequencer.SequenceItem.Utility.Annotation'],
  ['Utility', 'External Script', 'NINA.Sequencer.SequenceItem.Utility.ExternalScript'],
];
const TRIGGER_TYPES = [
  ['Advanced API', 'Send Error to WebSocket', 'ninaAPI.SequenceItems.SendErrorTrigger'],
  [
    'Connect',
    'Reconnect Camera On Download Failure',
    'NINA.Sequencer.Trigger.Connect.ReconnectOnDownloadFailure',
  ],
  ['Connect', 'Reconnect Equipment', 'NINA.Sequencer.Trigger.Connect.ReconnectTrigger'],
  ['Dome', 'Synchronize Dome', 'NINA.Sequencer.Trigger.Dome.SynchronizeDomeTrigger'],
  ['Focuser', 'AF After # Exposures', 'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterExposures'],
  [
    'Focuser',
    'AF After Filter Change',
    'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterFilterChange',
  ],
  [
    'Ground Station',
    'Failures to Discord',
    'DaleGhent.NINA.GroundStation.FailuresToDiscordWebhookTrigger.FailuresToDiscordWebhookTrigger',
  ],
  [
    'Ground Station',
    'Failures to Email',
    'DaleGhent.NINA.GroundStation.FailuresToEmailTrigger.FailuresToEmailTrigger',
  ],
  ['Guider', 'Dither after Exposures', 'NINA.Sequencer.Trigger.Guider.DitherAfterExposures'],
  ['Guider', 'Restore Guiding', 'NINA.Sequencer.Trigger.Guider.RestoreGuiding'],
  [
    'Phd2 Tools',
    'Interrupt and retry when RMS above',
    'nina.plugin.phd2tools.Phd2ToolsSequenceItems.InterruptAndRetryWhenRMSAbove',
  ],
  [
    'Phd2 Tools',
    'Interrupt when RMS above',
    'nina.plugin.phd2tools.Phd2ToolsSequenceItems.InterruptWhenRMSAbove',
  ],
  ['Safety Monitor', 'Trigger On Unsafe', 'NINA.Sequencer.Trigger.SafetyMonitor.TriggerOnUnsafe'],
  [
    'Telescope',
    'Center After Drift',
    'NINA.Sequencer.Trigger.Platesolving.CenterAfterDriftTrigger',
  ],
  ['Telescope', 'Meridian Flip', 'NINA.Sequencer.Trigger.MeridianFlip.MeridianFlipTrigger'],
  ['Utility', 'Custom Trigger', 'NINA.Sequencer.Trigger.Utility.CustomTrigger'],
];
const CONDITION_TYPES = [
  ['Loop Condition', 'Loop For Iterations', 'NINA.Sequencer.Conditions.LoopCondition'],
  ['Loop Condition', 'Loop for Time Span', 'NINA.Sequencer.Conditions.TimeSpanCondition'],
  ['Loop Condition', 'Loop until Altitude Below', 'NINA.Sequencer.Conditions.AltitudeCondition'],
  ['Loop Condition', 'Loop until Moon Altitude', 'NINA.Sequencer.Conditions.MoonAltitudeCondition'],
  ['Loop Condition', 'Loop until Sun Altitude', 'NINA.Sequencer.Conditions.SunAltitudeCondition'],
  ['Loop Condition', 'Loop Until Time', 'NINA.Sequencer.Conditions.TimeCondition'],
  ['Loop Condition', 'Loop While', 'NINA.Sequencer.Conditions.LoopWhile'],
  [
    'Loop Condition',
    'Loop while Altitude Above Horizon',
    'NINA.Sequencer.Conditions.AboveHorizonCondition',
  ],
];

const typeList = (types) => ({
  Success: true,
  Error: '',
  Total: types.length,
  Items: types.map(([Category, Name, FullTypeName]) => ({ Name, Category, FullTypeName })),
});

const SEQUENCE_FILES = [
  { FileName: 'M31 narrowband.json', FilePath: 'C:\Sequences\M31 narrowband.json' },
  { FileName: 'Flats.json', FilePath: 'C:\Sequences\Flats.json' },
];

// The plugin answers these with bare JSON, not in the Advanced API envelope.
export const SEQUENCE_ROUTES = {
  '/api/sequence/current': () => TREE,
  '/api/sequence/status': () => ({
    Revision: 'fixture-1',
    Running: true,
    Items: statusEntries(TREE),
  }),
  '/api/sequence/items': () => typeList(ITEM_TYPES),
  '/api/sequence/triggers': () => typeList(TRIGGER_TYPES),
  '/api/sequence/conditions': () => typeList(CONDITION_TYPES),
  '/api/sequence/files': () => ({ Sequences: SEQUENCE_FILES }),
};
