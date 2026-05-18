import TakeExposureItem from './TakeExposureItem.vue';
import TakeManyExposuresItem from './TakeManyExposuresItem.vue';
import TakeSubframeExposureItem from './TakeSubframeExposureItem.vue';
import SwitchFilterItem from './SwitchFilterItem.vue';
import SwitchProfileItem from './SwitchProfileItem.vue';
import ToggleLightItem from './ToggleLightItem.vue';
import SetBrightnessItem from './SetBrightnessItem.vue';
import AutoBrightnessFlatItem from './AutoBrightnessFlatItem.vue';
import AutoExposureFlatItem from './AutoExposureFlatItem.vue';
import SkyFlatItem from './SkyFlatItem.vue';
import TrainedDarkFlatExposureItem from './TrainedDarkFlatExposureItem.vue';
import TrainedFlatExposureItem from './TrainedFlatExposureItem.vue';
import PolarAlignmentItem from './PolarAlignmentItem.vue';
import MoveRotatorMechanicalItem from './MoveRotatorMechanicalItem.vue';
import SolveAndRotateItem from './SolveAndRotateItem.vue';
import WaitUntilSafeItem from './WaitUntilSafeItem.vue';
import SetSwitchValueItem from './SetSwitchValueItem.vue';
import SetTrackingItem from './SetTrackingItem.vue';
import SlewScopeToAltAzItem from './SlewScopeToAltAzItem.vue';
import CenterAndRotateItem from './CenterAndRotateItem.vue';
import ExpressionVariableItem from './ExpressionVariableItem.vue';
import ScopedVariableItem from './ScopedVariableItem.vue';
import ResetVariableItem from './ResetVariableItem.vue';
import ResetVariableToDateItem from './ResetVariableToDateItem.vue';
import AnnotationItem from './AnnotationItem.vue';
import WaitForAltitudeItem from './WaitForAltitudeItem.vue';
import WaitForTimeItem from './WaitForTimeItem.vue';
import WaitForBodyAltitudeItem from './WaitForBodyAltitudeItem.vue';
import WaitUntilItem from './WaitUntilItem.vue';
import WaitUntilAboveHorizonItem from './WaitUntilAboveHorizonItem.vue';
import WaitForTimeSpanItem from './WaitForTimeSpanItem.vue';
import SlewDomeAzimuthItem from './SlewDomeAzimuthItem.vue';
import StackFlatsItem from './StackFlatsItem.vue';
import ChangePHD2ParametersItem from './ChangePHD2ParametersItem.vue';
import InterruptWhenRMSAboveItem from './InterruptWhenRMSAboveItem.vue';
import LoopConditionItem from './LoopConditionItem.vue';
import LoopForTimeSpanItem from './LoopForTimeSpanItem.vue';
import LoopWhileItem from './LoopWhileItem.vue';
import LoopWhileUnsafeItem from './LoopWhileUnsafeItem.vue';
import TimeConditionItem from './TimeConditionItem.vue';
import DitherAfterExposuresItem from './DitherAfterExposuresItem.vue';
import SmartExposureItem from './SmartExposureItem.vue';
import RunAutofocusItem from './RunAutofocusItem.vue';
import SequentialContainerItem from './SequentialContainerItem.vue';
import CenterItem from './CenterItem.vue';
import SlewScopeToRaDecItem from './SlewScopeToRaDecItem.vue';
import DeepSkyObjectContainerItem from './DeepSkyObjectContainerItem.vue';
import WarmCameraItem from './WarmCameraItem.vue';
import MoonAltitudeConditionItem from './MoonAltitudeConditionItem.vue';
import MoonIlluminationConditionItem from './MoonIlluminationConditionItem.vue';
import AltitudeConditionItem from './AltitudeConditionItem.vue';
import SunAltitudeConditionItem from './SunAltitudeConditionItem.vue';
import AboveHorizonConditionItem from './AboveHorizonConditionItem.vue';
import SafetyMonitorConditionItem from './SafetyMonitorConditionItem.vue';
import SynchronizeDomeTriggerItem from './SynchronizeDomeTriggerItem.vue';
import ReconnectTriggerItem from './ReconnectTriggerItem.vue';
import AutofocusAfterExposuresItem from './AutofocusAfterExposuresItem.vue';
import AutofocusAfterHFRIncreaseItem from './AutofocusAfterHFRIncreaseItem.vue';
import AutofocusAfterTemperatureChangeItem from './AutofocusAfterTemperatureChangeItem.vue';
import AutofocusAfterTimeItem from './AutofocusAfterTimeItem.vue';
import CenterAfterDriftTriggerItem from './CenterAfterDriftTriggerItem.vue';
import MeridianFlipTriggerItem from './MeridianFlipTriggerItem.vue';
import CoolCameraItem from './CoolCameraItem.vue';
import DewHeaterItem from './DewHeaterItem.vue';
import SetUSBLimitItem from './SetUSBLimitItem.vue';
import SetReadoutModeItem from './SetReadoutModeItem.vue';
import AutoBalancingExposureItem from './AutoBalancingExposureItem.vue';
import OrbuculumNextTargetAltitudeItem from './OrbuculumNextTargetAltitudeItem.vue';
import OrbuculumNextTargetHorizonItem from './OrbuculumNextTargetHorizonItem.vue';
import OrbuculumHourAngleItem from './OrbuculumHourAngleItem.vue';
import OrbuculumNextTargetHourAngleItem from './OrbuculumNextTargetHourAngleItem.vue';
import MoveFocuserAbsoluteItem from './MoveFocuserAbsoluteItem.vue';
import MoveFocuserRelativeItem from './MoveFocuserRelativeItem.vue';
import MoveFocuserByTemperatureItem from './MoveFocuserByTemperatureItem.vue';
import GenericItem from './GenericItem.vue';

export const ITEM_COMPONENTS = {
  'NINA.Sequencer.SequenceItem.Imaging.TakeExposure': TakeExposureItem,
  'NINA.Sequencer.SequenceItem.Imaging.TakeSubframeExposure': TakeSubframeExposureItem,
  'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter': SwitchFilterItem,
  'NINA.Sequencer.Conditions.LoopCondition': LoopConditionItem,
  'NINA.Sequencer.Conditions.TimeSpanCondition': LoopForTimeSpanItem,
  'NINA.Sequencer.Conditions.TimeCondition': TimeConditionItem,
  'NINA.Sequencer.Conditions.LoopWhile': LoopWhileItem,
  'NINA.Sequencer.Conditions.LoopWhileUnsafe': LoopWhileUnsafeItem,
  'NINA.Sequencer.Conditions.AltitudeCondition': AltitudeConditionItem,
  'NINA.Sequencer.Conditions.SunAltitudeCondition': SunAltitudeConditionItem,
  'NINA.Sequencer.Conditions.AboveHorizonCondition': AboveHorizonConditionItem,
  'NINA.Sequencer.Conditions.SafetyMonitorCondition': SafetyMonitorConditionItem,
  'NINA.Sequencer.Conditions.MoonAltitudeCondition': MoonAltitudeConditionItem,
  'NINA.Sequencer.Conditions.MoonIlluminationCondition': MoonIlluminationConditionItem,
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterExposures': AutofocusAfterExposuresItem,
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterFilterChange': RunAutofocusItem,
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterHFRIncreaseTrigger':
    AutofocusAfterHFRIncreaseItem,
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterTemperatureChangeTrigger':
    AutofocusAfterTemperatureChangeItem,
  'NINA.Sequencer.Trigger.Autofocus.AutofocusAfterTimeTrigger': AutofocusAfterTimeItem,
  'NINA.Sequencer.Trigger.Guider.DitherAfterExposures': DitherAfterExposuresItem,
  'NINA.Sequencer.Trigger.Guider.RestoreGuiding': RunAutofocusItem,
  'NINA.Sequencer.Trigger.Platesolving.CenterAfterDriftTrigger': CenterAfterDriftTriggerItem,
  'NINA.Sequencer.Trigger.MeridianFlip.MeridianFlipTrigger': MeridianFlipTriggerItem,
  'NINA.Sequencer.SequenceItem.Imaging.TakeManyExposures': TakeManyExposuresItem,
  'NINA.Sequencer.SequenceItem.Imaging.SmartExposure': SmartExposureItem,
  'NINA.Sequencer.SequenceItem.Autofocus.RunAutofocus': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Autofocus.RunAberrationInspector': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Focuser.MoveFocuserAbsolute': MoveFocuserAbsoluteItem,
  'NINA.Sequencer.SequenceItem.Focuser.MoveFocuserRelative': MoveFocuserRelativeItem,
  'NINA.Sequencer.SequenceItem.Focuser.MoveFocuserByTemperature': MoveFocuserByTemperatureItem,
  'NINA.Sequencer.SequenceItem.Telescope.UnparkScope': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Telescope.ParkScope': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Telescope.FindHome': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Guider.StartGuiding': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Guider.Dither': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Guider.StopGuiding': RunAutofocusItem,
  'ninaAPI.SequenceItems.SendErrorTrigger': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Connect.SwitchProfile': SwitchProfileItem,
  'NINA.Sequencer.SequenceItem.Connect.ConnectAllEquipment': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Connect.DisconnectAllEquipment': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Connect.ConnectEquipment': ReconnectTriggerItem,
  'NINA.Sequencer.SequenceItem.Connect.DisconnectEquipment': ReconnectTriggerItem,
  'NINA.Sequencer.Trigger.Connect.ReconnectOnDownloadFailure': ReconnectTriggerItem,
  'NINA.Sequencer.Trigger.Connect.ReconnectTrigger': ReconnectTriggerItem,
  'NINA.Sequencer.Trigger.Dome.SynchronizeDomeTrigger': SynchronizeDomeTriggerItem,
  'NINA.Sequencer.Container.SequentialContainer': SequentialContainerItem,
  'NINA.Sequencer.Container.ParallelContainer': SequentialContainerItem,
  'NINA.Sequencer.SequenceItem.Platesolving.Center': CenterItem,
  'NINA.Sequencer.Container.DeepSkyObjectContainer': DeepSkyObjectContainerItem,
  'NINA.Sequencer.SequenceItem.Camera.WarmCamera': WarmCameraItem,
  'NINA.Sequencer.SequenceItem.Camera.CoolCamera': CoolCameraItem,
  'NINA.Sequencer.SequenceItem.Camera.DewHeater': DewHeaterItem,
  'NINA.Sequencer.SequenceItem.Camera.SetUSBLimit': SetUSBLimitItem,
  'NINA.Sequencer.SequenceItem.Camera.SetReadoutMode': SetReadoutModeItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.CloseCover': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.OpenCover': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.ToggleLight': ToggleLightItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.SetBrightness': SetBrightnessItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.AutoBrightnessFlat': AutoBrightnessFlatItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.AutoExposureFlat': AutoExposureFlatItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.SkyFlat': SkyFlatItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.TrainedDarkFlatExposure': TrainedDarkFlatExposureItem,
  'NINA.Sequencer.SequenceItem.FlatDevice.TrainedFlatExposure': TrainedFlatExposureItem,
  'NINA.Plugins.PolarAlignment.Instructions.PolarAlignment': PolarAlignmentItem,
  'NINA.Sequencer.SequenceItem.Rotator.MoveRotatorMechanical': MoveRotatorMechanicalItem,
  'NINA.Sequencer.SequenceItem.Platesolving.SolveAndRotate': SolveAndRotateItem,
  'NINA.Sequencer.SequenceItem.SafetyMonitor.WaitUntilSafe': WaitUntilSafeItem,
  'NINA.Sequencer.SequenceItem.Switch.SetSwitchValue': SetSwitchValueItem,
  'NINA.Sequencer.SequenceItem.Telescope.SetTracking': SetTrackingItem,
  'NINA.Sequencer.SequenceItem.Telescope.SlewScopeToAltAz': SlewScopeToAltAzItem,
  'NINA.Sequencer.SequenceItem.Telescope.SlewScopeToRaDec': SlewScopeToRaDecItem,
  'NINA.Sequencer.SequenceItem.Platesolving.CenterAndRotate': CenterAndRotateItem,
  'NINA.Sequencer.SequenceItem.Platesolving.SolveAndSync': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Expressions.GlobalConstant': ExpressionVariableItem,
  'NINA.Sequencer.SequenceItem.Expressions.Variable': ScopedVariableItem,
  'NINA.Sequencer.SequenceItem.Expressions.GlobalVariable': ScopedVariableItem,
  'NINA.Sequencer.SequenceItem.Expressions.ResetVariable': ResetVariableItem,
  'NINA.Sequencer.SequenceItem.Expressions.ResetVariableToDate': ResetVariableToDateItem,
  'NINA.Sequencer.SequenceItem.Utility.Annotation': AnnotationItem,
  'NINA.Sequencer.SequenceItem.Utility.MessageBox': AnnotationItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitForAltitude': WaitForAltitudeItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitUntilAboveHorizon': WaitUntilAboveHorizonItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitForTime': WaitForTimeItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitForMoonAltitude': WaitForBodyAltitudeItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitForSunAltitude': WaitForBodyAltitudeItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitUntil': WaitUntilItem,
  'NINA.Sequencer.SequenceItem.Utility.WaitForTimeSpan': WaitForTimeSpanItem,
  'NINA.Sequencer.SequenceItem.Dome.CloseDomeShutter': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.DisableDomeSynchronization': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.EnableDomeSynchronization': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.FindHomeDome': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.OpenDomeShutter': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.ParkDome': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.SynchronizeDome': RunAutofocusItem,
  'NINA.Sequencer.SequenceItem.Dome.SlewDomeAzimuth': SlewDomeAzimuthItem,
  'NINA.Plugin.Livestack.Instructions.StackFlats': StackFlatsItem,
  'NINA.Plugin.Livestack.Instructions.StartLivestacking': RunAutofocusItem,
  'NINA.Plugin.Livestack.Instructions.StopLivestacking': RunAutofocusItem,
  'nina.plugin.phd2tools.Phd2ToolsSequenceItems.Phd2SettleInstruction': RunAutofocusItem,
  'nina.plugin.phd2tools.Phd2ToolsSequenceItems.ChangePHD2Parameters': ChangePHD2ParametersItem,
  'nina.plugin.phd2tools.Phd2ToolsSequenceItems.InterruptWhenRMSAbove': InterruptWhenRMSAboveItem,
  'nina.plugin.phd2tools.Phd2ToolsSequenceItems.RestartWhenSaturated': RunAutofocusItem,
  'nina.plugin.phd2tools.Phd2ToolsSequenceItems.Phd2SettleTrigger': RunAutofocusItem,
  'Orbuculum.Instructions.AutoBalancingExposure': AutoBalancingExposureItem,
  'Orbuculum.Instructions.LoopWhileNextTargetBelowAltitude': OrbuculumNextTargetAltitudeItem,
  'Orbuculum.Instructions.LoopWhileNextTargetBelowHorizon': OrbuculumNextTargetHorizonItem,
  'Orbuculum.Instructions.LoopWhileHourAngle': OrbuculumHourAngleItem,
  'Orbuculum.Instructions.WaitForHourAngle': OrbuculumHourAngleItem,
  'Orbuculum.Instructions.LoopWhileNextTargetHourAngle': OrbuculumNextTargetHourAngleItem,
  'NINA.Plugin.NightSummary.Sequencer.NightSummaryInstruction': GenericItem,
  'NINA.Plugin.NightSummary.Sequencer.NightSummaryEndInstruction': GenericItem,
  'TNS.Orbitals.OrbitalObjectTarget': GenericItem,
  'NINA.Joko.Plugin.Orbitals.SequenceItems.OrbitalObjectContainer, NINA.Joko.Plugin.Orbitals':
    DeepSkyObjectContainerItem,
  'NINA.Joko.Plugin.Orbitals.SequenceItems.SetTelescopeShiftRate, NINA.Joko.Plugin.Orbitals':
    GenericItem,
  'NINA.Joko.Plugin.Orbitals.SequenceItems.SetGuiderShiftRate, NINA.Joko.Plugin.Orbitals':
    GenericItem,
  'NINA.Joko.Plugin.Orbitals.SequenceItems.SetTelescopeShiftRateTrigger, NINA.Joko.Plugin.Orbitals':
    GenericItem,
  'NINA.Joko.Plugin.Orbitals.SequenceItems.SetGuiderShiftRateTrigger, NINA.Joko.Plugin.Orbitals':
    GenericItem,
};

export { GenericItem };

export const ORBITAL_TYPE = 'TNS.Orbitals.OrbitalObjectTarget';

