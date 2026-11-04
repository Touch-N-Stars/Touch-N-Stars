# Easy- und Expertenansicht

Status: implemented, pending review
Date: 2026-11-04

## Goal

Einsteiger arbeiten in einer Easy-Ansicht mit weniger Menüpunkten und Tabs und sehen nur, was sie
für eine normale Aufnahmenacht brauchen. Experten behalten die App unverändert. Der Modus lässt
sich jederzeit wechseln und ändert nur die Darstellung, nie den Zustand der Ausrüstung. Vorbild
sind die [einfache Sequenzansicht](simple-sequence-view.md) und das
[Hocus-Focus-Setup](hocus-focus-simple-setup.md).

Das Feature läuft in zwei Stufen. Stufe 1 ist das Grundgerüst aus Modus, Navigation und Tabs.
Stufe 2 vereinfacht die Inhalte innerhalb der Seiten (Kamera-Einstellungen, Fokus-Felder, Guider,
Montierungssteuerung, Einstellungen).

## Scope

- Runtime modes: NINA und PINS
- Surface: Navigation, Router, Einstellungen, Setup-Wizard, Kamera-, Montierungs-, Fokus- und
  Guider-Seite, Sequenzseite
- Backends touched: keine

## Non-goals

- Die Expertenansicht ändert sich nicht.
- Keine neuen Endpoints und keine Änderung an Polling oder Transporten.
- Ausgeblendete Werte werden nicht geändert oder zurückgesetzt, sie wirken weiter.
- Der PHD2-Guider ändert sich nicht, er hat nur zwei Tabs.
- Keine Route wird gesperrt. Easy ist eine Vereinfachung, keine Zugriffsbeschränkung.
- Die Hocus-Focus-Vereinfachung bleibt an `hocusFocusStore.available` gebunden.

## Acceptance criteria: Stufe 1

1. **Schalter:** Unter Einstellungen → Oberfläche wählt der Nutzer „Ansicht: Easy / Experte“. Die
   Wahl übersteht Neustart und Instanzwechsel, gilt pro Gerät und wird nicht ans Rig gespiegelt.
2. **Bestand:** Fehlt in den gespeicherten Einstellungen der neue Wert, startet die App als
   Experte. Navigation und Seiten bleiben dann genau wie vor dem Update.
3. **Wizard:** Direkt nach der Sprache fragt ein neuer Schritt nach dem Modus. Wer den Wizard
   abbricht, ohne etwas gewählt zu haben, bleibt Experte. Das automatische Öffnen bei einem neuen
   PINS-Profil startet hinter dem Schritt.
4. **Navigation:** Easy zeigt Ausrüstung, Kamera, Autofokus, Montierung, Guider, Sequenz,
   Monitoring, Flat-Assistent, Sky-Atlas, PINS (nur unter PINS), das Livestack-Plugin (wenn
   aktiviert) und Einstellungen, jeweils unter den heutigen Verbindungsbedingungen. Dome,
   Flat-Gerät, Switch, Filterrad, Rotator, Framing, Über und alle anderen Plugins sind ausgeblendet.
5. **Eigene Navbar bleibt erhalten:** Easy filtert nur beim Anzeigen. `navbar.hiddenItems` und das
   aufs Rig gespiegelte `navbar_settings` bleiben unverändert. In Easy gelten die eigenen
   Ausblendungen zusätzlich. Zurück in Experte ist die eigene Anordnung wieder exakt da.
6. **Routen:** `/` führt in Easy zum ersten sichtbaren Eintrag. Ausgeblendete Seiten bleiben per
   Statusleiste und Direktlink erreichbar, zum Beispiel Framing über den Framing-Button der
   einfachen Sequenzansicht.
7. **Tabs:** Montierung zeigt Steuerung, Slew und TPPA. Fokus zeigt Fokus und Einstellungen. Die
   Einstellungen zeigen Verbindung, Oberfläche, Bild, Filter, System und unter PINS den PINS-Link.
   Der Tab „Filter“ gibt es nur in Easy, und nur wenn das Profil Filter enthält. Er zeigt die
   Filter-Einstellungen der Filterrad-Seite und braucht kein verbundenes Filterrad. Ist der aktive
   Tab ausgeblendet, springt die Seite auf den ersten Tab; ein laufendes TPPA bleibt sichtbar, bis
   es beendet ist.
8. **Sequenz und Sicherheit:** Der Wechsel auf Easy setzt die einfache Sequenzansicht, der Wechsel
   auf Experte die volle. Der Link in den Experten-Editor ändert den globalen Modus nicht. Ein
   Moduswechsel sendet keinen Gerätebefehl und keinen Backend-Schreibzugriff. Statusleiste,
   Warnungen, Fehlermeldungen und Stopp-Bedienelemente bleiben in Easy vollständig. Die Filterlogik
   liegt getestet in `src/utils/appMode.js`.

## Acceptance criteria: Stufe 2

1. **Fokus-Einstellungen:** Easy zeigt nur den Untertab „Autofokus“ ohne Tab-Leiste, darin
   Belichtung, Startversatz und Schrittweite, unter Hocus Focus dessen einfache Karte samt
   Assistent. Der Einleitungstext der Karte verweist in Easy auf den Assistenten statt auf die
   Detail-Einstellungen. Filter-Offset, Settle Time, Versuche, Bilder pro Punkt und die
   HF-Speicherkarte sind ausgeblendet.
2. **Montierung:** Die Steuerung zeigt Parken, Entparken, Home, Stopp, Nachführung, Achsen umkehren
   und die manuelle Bewegung. „Als Parkposition setzen“ ist ausgeblendet.
3. **Kamera:** Im Einstellungs-Modal fehlen Readout-Modus und USB-Limit. Alles andere bleibt.
4. **Native Guider:** Auf dem Handy entfallen die Tabs Statistik, Kalibrierung und Log. Ein aus der
   Expertenansicht gemerkter Tab fällt auf Bild zurück. Große Bildschirme behalten Dashboard, Coach,
   Vorfälle und Einstellungen samt aller Dashboard-Karten.
5. **Einstellungen:** Unter Bild fehlen die Karte mit den Bildeinstellungen und das Dateimuster,
   Speicherpfad und Dateityp bleiben. Unter System fehlen Debug und Log-Level. Unter Verbindung
   fehlt die Horizontdatei.
6. **Sicherheit und Wechsel:** Kein ausgeblendetes Feld ändert seinen Wert. Ein Moduswechsel sendet
   keinen Gerätebefehl. Ein laufender Vorgang behält seine Anzeige und seinen Stopp-Knopf. Zurück
   in Experte sind alle Felder wieder da.

## Dimensions considered

| Dimension        | Applies | Note                                                                                      |
| ---------------- | ------- | ----------------------------------------------------------------------------------------- |
| Runtime modes    | yes     | Gleiche Listen in NINA und PINS, PINS-Eintrag bleibt an `store.isPINS` gebunden           |
| Polling          | yes     | Filter-Tab liest per `useBackgroundAwarePolling` (2 s), pausiert im Hintergrund           |
| Mobile           | yes     | Weniger Einträge, Schalter und Wizard-Schritt mit `min-h-touch`                           |
| i18n             | yes     | Neue Texte zuerst nur in `en.json`, die anderen 13 Sprachen gesammelt vor dem Commit      |
| Equipment safety | yes     | Kriterium 8: nur Darstellung, keine Befehle; laufendes TPPA bleibt sichtbar (Kriterium 7) |
| Error paths      | yes     | Fehlender oder unbekannter Wert zählt als Experte; Warnungen bleiben sichtbar             |
| Native           | no      | Reine Darstellung, kein Unterschied zwischen Android, iOS und Browser                     |
| Persistence      | yes     | `settingsStore` ist als Ganzes persistiert; `clearAllStates()` berührt den Wert nicht     |
| Tests            | yes     | Filter für Navigation und Tabs als Util in `src/utils/appMode.js`                         |

## Open questions

- Test auf echter Hardware und auf dem Gerät steht aus. (user)
