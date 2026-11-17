# Einfache Sequenzansicht

Status: in progress
Date: 2026-10-21

## Goal

Nutzer, die nur Targets aufnehmen wollen, bearbeiten die geladene NINA-Sequenz in einer
reduzierten, touch-freundlichen Ansicht: eine Liste ihrer Targets mit Filter × Belichtung ×
Anzahl und der geschätzten Dauer. Das nächste Target wird als Kopie hinzugefügt, statt die
Sequenz zu löschen und neu aufzubauen. Der vollständige Editor bleibt unverändert und ist
jederzeit umschaltbar. Anlass: wiederkehrende Discord-Anfragen nach dem NINA-Legacy-Sequencer.

## Scope

- Runtime modes: NINA und PINS, überall wo der Sequenz-Editor V2 verfügbar ist
  (`store.sequenceEditorAvailable`)
- Surface: Sequenzseite (`SequenceV2Page`), Framing/Atlas-Target-Picker
- Backends touched: keine neuen Endpoints. Genutzt werden `sequence/set`, `add`, `duplicate`,
  `remove`, `move` (TNS-Plugin-Server) und `sequence/set-target` (Advanced API).

## Non-goals

- Der vollständige Editor und der Sequence Creator ändern sich nicht. Einzige Ausnahme ist
  eine zusätzliche Option im Framing-Picker.
- Start, Ende und globale Trigger sind in der einfachen Ansicht nur über die Schalter aus
  Kriterium 3a editierbar.
- Kein „Delay start“ und kein „Sequence mode“ (Rotate through) aus dem Legacy-Sequencer: Beide
  würden die Struktur der Sequenz umbauen statt Werte zu setzen.
- Keine automatische Nachtplanung. Uhrzeiten und Höhenverlauf werden nur angezeigt.
- Keine neue Speicherung von Sequenzen. Speichern und Laden bleiben wie heute.

## Acceptance criteria

1. Ist eine Sequenz geladen und öffnet der Nutzer die Sequenzseite, ist die Experten-Ansicht
   aktiv. Im Tab „Einstellungen“ wählt der Nutzer „Ansicht: Einfach / Experte“. Unter der
   einfachen Ansicht führt der Link „Im Experten-Editor bearbeiten“, über der Experten-Ansicht
   der Link „Einfache Ansicht“ zurück, auch bei gesperrter Steuerung. Der Wechsel verändert die
   Sequenz nicht. Die Wahl bleibt nach einem App-Neustart auf diesem Gerät erhalten.
2. In der einfachen Ansicht erscheint jeder DSO-Container als Karte, in Sequenzreihenfolge.
   Jede Karte zeigt Name, RA/Dec, Rotation und je Belichtungs-Item (Smart Exposure, Take Many
   Exposures) eine Zeile: Filter, Belichtungszeit, erledigt/gesamt. Dazu kommt die geschätzte
   Dauer pro Target und für alle Targets zusammen, berechnet als verbleibende Anzahl ×
   (Belichtungszeit + fester Zuschlag von 5 s pro Bild für Download und Speichern). Jede Karte zeigt außerdem die erwartete Uhrzeit von–bis, die Übersicht
   „Fertig um“. Die Targets werden dafür ab jetzt hintereinander gereiht.
   2a. Hat das Target Koordinaten und das Profil einen Standort, zeigt die Karte den
   Höhenverlauf über die Nacht (`SkyChart`). Name, Rotation und RA/Dec lassen sich auch von
   Hand eingeben.
3. Start, Ende und globale Trigger erscheinen als je eine Zeile, nur zum Lesen, zum Beispiel
   „Start: Cool Camera, Unpark Scope“. Ein Tipp darauf wechselt in die vollständige Ansicht.

   3a. Darüber gibt es Schalter für Meridian Flip und Dithern alle N Bilder (global), Kamera
   kühlen mit Temperatur und Dauer sowie Montierung entparken (Start) und Kamera aufwärmen mit
   Dauer sowie Montierung parken (Ende). Ausschalten deaktiviert das vorhandene Item,
   Einschalten aktiviert es wieder oder legt es an, wenn es fehlt. Neue Items landen in der
   Reihenfolge Kühlen → Entparken bzw. Aufwärmen → Parken.
   Beim Einschalten des globalen Ditherns werden die eingebauten Dither-Trigger der Smart
   Exposures auf 0 gesetzt, aber nur wenn der globale Trigger danach wirklich aktiv ist.
   Beim Ausschalten bleiben sie bei 0.

4. Wählt der Nutzer auf einer Karte ein Target über Suche oder Favoriten, zeigt die Karte
   innerhalb eines Poll-Zyklus (2 s) die neuen Werte. Andere Karten bleiben unberührt. Der
   Framing-Button lädt das Target in den Framing-Assistenten. Von dort führt der bestehende
   Picker zurück.
5. Der Nutzer kann auf einer Karte Filter, Belichtungszeit und Anzahl einer Belichtungszeile
   ändern, und aufgeklappt auch Gain, Offset, Bildtyp und Binning. Jede Zeile lässt sich aus-
   und einschalten. Er kann eine neue Zeile hinzufügen (Smart Exposure) und eine Zeile nach
   Rückfrage löschen. Die Änderung ist danach auch im vollständigen Editor sichtbar.
   5a. Unter „Target options“ (eingeklappt, mit Zusammenfassung) wählt der Nutzer pro Target
   den Anflug (aus / Slew / Slew und zentrieren / Zentrieren und rotieren) und schaltet „Start
   guiding“ sowie Autofokus beim Start, nach Filterwechsel, nach Zeit, nach Anzahl Bilder,
   nach Temperaturänderung und nach HFR-Anstieg, jeweils mit ihrem Wert. Es ist immer nur ein
   Anflug aktiv. Die anderen werden deaktiviert, nicht gelöscht. Neue Schritte landen vor den
   Belichtungen in der Reihenfolge Anflug → Guiding → Autofokus. Schritte eines laufenden
   Targets sind gesperrt, seine Autofokus-Trigger bleiben schaltbar.
6. „Target als Kopie hinzufügen“ legt direkt nach der Karte einen Container mit denselben
   Belichtungszeilen an. Targets lassen sich nach Rückfrage löschen und nach oben/unten
   verschieben. Der Framing/Atlas-Picker bietet zusätzlich „Kopie von Target X“.
7. Läuft die Sequenz, zeigen die Karten den Fortschritt live. Das gerade laufende Item ist
   gesperrt, wie im vollständigen Editor, und eine Ablehnung durch das Backend erscheint als
   Toast. Ist die Steuerung gesperrt (Auto-Lock), ist die ganze Ansicht schreibgeschützt.
8. Items, die die einfache Ansicht nicht darstellt (Wait, verschachtelte Container …),
   bleiben unverändert erhalten. Die Karte weist sie aus, zum Beispiel
   „+3 weitere Schritte“. Enthält die Sequenz keinen DSO-Container, erscheint ein Hinweis mit
   dem Button „Target hinzufügen“.

## Dimensions considered

| Dimension        | Applies | Note                                                                          |
| ---------------- | ------- | ----------------------------------------------------------------------------- |
| Runtime modes    | yes     | Gleiche Plugin-Endpoints in NINA und PINS, Felder am Payload erkennen         |
| Polling          | yes     | Vorhandener 2-s-Poller von `sequenceV2Store`, kein neuer                      |
| Mobile           | yes     | Karten auf schmalem Viewport, `min-h-touch`, `NumberInputPicker`              |
| i18n             | yes     | Neue Texte zuerst nur in `en.json`                                            |
| Equipment safety | no      | Bewegt nichts, Starten bleibt der bestehende Start-Button                     |
| Error paths      | yes     | Backend-Neustart, gesperrtes Item, fehlende Felder                            |
| Native           | no      | Kein nativer Unterschied                                                      |
| Persistence      | yes     | Ansichtswahl in `settingsStore` (persistiert, pro Gerät)                      |
| Tests            | yes     | Zeitschätzung und Container → Karte als Util in `src/utils/sequenceSimple.js` |

## Open questions

- Keine.
