# Flats im Einfach-Modus

Status: implemented, pending review
Date: 2026-11-22

## Goal

Ein Einsteiger, der von der ASIAIR kommt, nimmt am Ende der Nacht seine Flats direkt auf der
Startseite des Einfach-Modus auf, ohne Fachwissen: Lichtquelle, Filter, Anzahl und Zielname sind
sinnvoll vorbelegt, ein Tipp startet. Histogramm-Werte oder das Verfahren (Auto exposure / Auto
brightness) muss er nicht kennen. Wer keine Flats will, überspringt den Schritt.

## Scope

- Runtime modes: PINS (der Einfach-Modus existiert nur dort, siehe `pins-simple-mode.md`)
- Surface: Startseite `/start`, neue Schrittkarte „Flats“ in „Your night“
- Backends touched: keine neuen. Vorhandener Flat-Workflow des TNS-Plugins (Server-Lauf über
  `flatassistantStore.startServerRun`, Fallback: Ablauf in der App), Flat-Panel über die
  vorhandenen Gerätedaten (`flatdeviceInfo`)

## Non-goals

- Keine Dämmerungsflats (SkyFlat) im Einfach-Modus
- Keine Flats im Plan: Sie laufen über den Flat-Assistenten, nicht als Sequenzschritt
- Kein Anfahren der Montierung (kein „Slew to zenith“ im Einfach-Modus)
- Der volle Flat-Assistent auf `/flats` ändert sich nicht
- Kein neuer Backend-Endpoint
- Flats starten nie von selbst
- Ein Satz Flats pro Nacht; keine getrennten Flats pro Ziel

## Acceptance criteria

1. **Schritt.** Given der Einfach-Modus auf PINS, then zeigt „Your night“ den Schritt „Flats“
   zwischen „Take pictures“ und „End the night“, mit „Erledigt“, „Läuft“, „Offen“ oder
   „Übersprungen“. „Skip tonight“ markiert ihn für die laufende Nacht (12 bis 12 Uhr, wie die
   anderen Markierungen) und übersteht einen App-Neustart. „Erledigt“ heißt: In dieser Nacht ist
   ein Flat-Lauf erfolgreich zu Ende gegangen.
2. **Lichtquelle.** Given ein verbundenes Flat-Panel mit Helligkeitsregelung, then ist
   „Flat-Panel“ vorgewählt (Auto brightness), sonst „Tablet / Leuchtfolie“ (Auto exposure). Der
   Nutzer kann umschalten; eine dritte Option gibt es nicht.
3. **Filter, Werte, Zielname.**
   - Given ein Filterrad, then sind die Filter der Belichtungszeilen des Plans vorausgewählt und
     per Häkchen änderbar. Ohne Filterrad läuft ein Durchgang ohne Filterwechsel.
   - Anzahl: Standard 20. Gain, Offset, Binning und Belichtungs- bzw. Helligkeitsgrenzen kommen
     aus den Flat-Einstellungen des Profils (`FlatWizardFilterSettings`). Histogramm, Toleranz und
     ADU erscheinen nicht. „Alle Einstellungen“ öffnet `/flats`.
   - Der Zielname der Flats ist der des Plans, damit sie bei den Bildern des Ziels landen. Bei
     mehreren Zielen der des zuletzt aufgenommenen Ziels (siehe offene Fragen). Ohne Ziel im Plan
     bleibt er leer.
4. **Dark-Flats.** Ein Häkchen, standardmäßig aus. Ist es an, folgen die Dark-Flats nach den
   Flats, mit der vorhandenen Aufforderung zum Abdecken bzw. geschlossenem Panel.
5. **Start und Fortschritt.**
   - Nur „Flats aufnehmen“ startet den Lauf; er geht als Server-Lauf aufs Rig.
   - Der Schritt zeigt den Fortschritt je Filter (z. B. „Ha 12 / 20“) und das Ergebnis je Filter
     in Klartext, z. B. „zu dunkel – helleres Licht oder längere Maximalbelichtung“.
   - Der Lauf geht weiter, wenn die App geschlossen wird; beim Wiederöffnen sind Fortschritt bzw.
     Ergebnis zu sehen. „Stop“ bricht ab.
   - Ohne Server-Lauf (ältere Plugins) sagt der Schritt, dass ein neueres Plugin nötig ist, und
     verweist auf den Flat-Assistenten. _Geändert bei der Umsetzung:_ Der alte, in der App
     gesteuerte Ablauf wird im Einfach-Modus nicht nachgebaut.
   - Das Ergebnis eines Filters zeigt die Meldung des Rigs, wenn es eine gibt (sie sagt, was den
     Lauf beendet hat); sonst den Klartext. Das Plugin leitet „zu dunkel/zu hell“ nur aus dem
     zuletzt gemessenen Pegel ab.
6. **Sperren.**
   - „Flats aufnehmen“ ist mit Begründung gesperrt, solange der Plan läuft, keine Kamera
     verbunden ist oder schon ein Flat-Lauf läuft.
   - Während Flats laufen, ist „Nacht beenden“ gesperrt, mit dem Hinweis „Flats laufen noch“.
7. **Reihenfolge.** Given der Plan ist fertig, then ist „Flats“ der hervorgehobene nächste
   Schritt vor „Nacht beenden“, sofern er nicht erledigt oder übersprungen ist.
8. **Qualität.**
   - Alle neuen Texte stehen in `en.json`; die anderen 13 Sprachen kommen gesammelt vor dem
     Commit.
   - Die reine Logik hat Unit-Tests: Schrittstatus, Wahl der Lichtquelle, Filter und Zielname aus
     dem Plan.
   - Die Startseite zeigt bei 390 px und 1024 px keinen horizontalen Überlauf
     (`npm run test:browser`).

## Dimensions considered

| Dimension        | Applies | Note                                                                                                  |
| ---------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Runtime modes    | yes     | Nur PINS, wie der ganze Einfach-Modus (`store.isPINS`)                                                |
| Polling          | yes     | Kein neuer Poller: `flatassistantStore` fragt den Status (auch des Server-Laufs) schon ab             |
| Mobile           | yes     | Schrittkarte mit `min-h-touch`, `tns-*`, Filter als Häkchenliste                                      |
| i18n             | yes     | Neue Texte zuerst nur in `en.json`                                                                    |
| Equipment safety | yes     | Panel-Abdeckung und Licht schalten nur nach „Flats aufnehmen“; die Montierung bewegt sich nie         |
| Error paths      | yes     | Panel getrennt, Belichtung nicht bestimmbar (je Filter), Backend-Neustart mitten im Lauf → Status neu |
| Native           | no      | Keine Capacitor-API                                                                                   |
| Persistence      | yes     | „Übersprungen“ als Nachtmarkierung (`settingsStore.simpleMode.steps.marks`), Status des Server-Laufs  |
| Tests            | yes     | Utilities für Schrittstatus, Lichtquelle, Filter und Zielname aus dem Plan                            |

## Verification (2026-11-22)

Gegen PINS im Docker mit Sky-Simulator und Flip-Flat-Simulator (MaxBrightness 255), ohne
Filterrad:

- Schritt 9 „Flats“ zwischen „Take pictures“ und „End the night“; „Flat-Panel“ vorgewählt.
- Panel-Lauf (Auto brightness): läuft als Server-Lauf, Schritt „Running“ mit Fortschritt
  „0 / 3“, „End the night“ gesperrt mit Hinweis. Ergebnis (der Simulator reagiert nicht auf das
  Panel) als Meldung des Rigs.
- Tablet-Lauf (Auto exposure, Zielhelligkeit im Profil gesenkt): 19 Flats à 10 s, Schritt
  „Done“, „Flats taken tonight“.
- Gestoppter Lauf → Schritt wieder offen. Plan (M 31, 1 × 1 s) fertig → Flats-Karte unter der
  Bilanz, Text „Take your flats now…“, „End the night“ als Zweitknopf. Nach erfolgreichen Flats
  verschwindet die Karte, „End the night“ ist wieder vorn.
- Zielname: `OBJECT = 'M31 · Andromeda Galaxy'` in den Flats.
- `npm run test:browser` grün (Startseite bei 390 px und 1024 px).

Nicht live geprüft: Filterrad mit Vorauswahl aus dem Plan (Unit-Tests), Dark-Flats mit
Abdeck-Aufforderung (vorhandener Ablauf des Assistenten).

## Open questions

- Zielname bei mehreren Zielen in einer Nacht: umgesetzt ist das zuletzt aufgenommene Ziel.
  Entscheidung beim Nutzer, falls sich das in der Praxis als unpassend zeigt.
- Zielnamen aus dem Atlas enthalten „·“ (kein ASCII). NINA schreibt ihn in Lights als `?`, in
  Flats landen die UTF-8-Bytes im FITS-Header – `OBJECT` von Lights und Flats unterscheidet sich.
  Betrifft die Benennung im Atlas, nicht dieses Feature.
