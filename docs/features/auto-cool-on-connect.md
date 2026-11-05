# Auto cool on connect

Status: in progress
Date: 2026-11-05

## Goal

A user who always cools the camera after connecting it no longer has to open the cooler
settings every session. With the option on, the camera cools down to its target by itself
when it connects, and the dew heater comes on with it if that is wanted.

## Scope

- Runtime modes: both (NINA/WPF and PINS/headless, same `/equipment/camera/cool` and
  `/equipment/camera/dew-heater` routes)
- Surface: cooler settings (`settingsCameraCooler.vue`, full view only, not the status bar panel)
- Backends touched: no new routes; Advanced API camera routes and the plugin's `/api/settings`

## Non-goals

- No automatic warm-up on disconnect.
- No separate target temperature: the profile's target and cooling time are used, the same
  values as the manual Cool down button.
- No dew heater strength handling; the heater is switched on at the strength already set.
- A camera with a dew heater but no cooler has no auto start.
- Nothing runs while the app is closed: the logic lives in the client.

## Acceptance criteria

1. With the option off (the default) a camera connect commands nothing.
2. With the option on, a camera connect the app sees starts cooling to the profile target
   over the profile cooling time, whichever client connected the camera.
3. A camera that was already connected when the app attached to the backend is not commanded,
   also after a lost backend connection.
4. A cooler that is already on or a running temperature ramp stays as it is.
5. With the dew heater option on, a heater that is off is switched on. The option only appears
   for a camera with a dew heater.
6. A camera without a cooler gets no command and no message.
7. The user is told in one toast what was started. A refused or failed action shows the
   backend's reason and stays on screen until closed.
8. While a sequence is known to run, nothing is commanded.
9. The choice applies to one profile on one backend: another profile, or the same profile id
   on another backend, keeps its own value, and a profile without a stored value has it off.
10. The profile active at the moment of the connect decides, also if it was switched from
    another client just before.
11. A choice that could not be saved snaps back and says so.

## Dimensions considered

| Dimension        | Applies | Note                                                                                     |
| ---------------- | ------- | ---------------------------------------------------------------------------------------- |
| Runtime modes    | yes     | no `isPINS` branch, capabilities come from `cameraInfo`                                  |
| Polling          | yes     | no new poller; runs from the existing `cameraInfo` watch, armed by the event history     |
| Mobile           | yes     | two toggle rows in the existing card                                                     |
| i18n             | yes     | new keys in `en.json`; other locales in one batch before the commit                      |
| Equipment safety | yes     | opt-in, connect edge only, existing state is never overridden, every action is announced |
| Error paths      | yes     | refusals and exceptions end in a persistent toast                                        |
| Native           | no      | no Capacitor API involved                                                                |
| Persistence      | yes     | backend setting `camera_auto_start_<profileId>`, never in the persisted `settingsStore`  |
| Tests            | yes     | `src/store/__tests__/autoCoolOnConnect.test.js`, contract fakes only                     |

## Known limits

- `sequenceRunning` is only polled while the sequence page is open, so criterion 8 cannot
  catch a run started elsewhere. The cooler and ramp checks of criterion 4 still apply.
- With two clients open on the same backend both react to the connect. The second start
  cancels the first ramp and starts it again, the camera still ends up cooling.

- Deleting a profile leaves its small `camera_auto_start_<profileId>` entry on the backend.
- If the backend cannot answer the settings read at connect time, nothing is started and the
  app only logs it, since it cannot know whether the option was on.

## Open questions

- Not yet verified on real hardware or the simulator (maintainer).
