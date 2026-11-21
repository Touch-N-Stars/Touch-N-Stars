# Einfach-Modus für PINS

Status: implemented, pending review
Date: 2026-11-20

## Goal

Wer von der ASIAIR auf PINS umsteigt und technisch nicht so bewandert ist, findet sich in TNS
heute nicht zurecht: 15+ Navigationseinträge, Fachbegriffe aus NINA (Framing, Sequenz,
Trigger, TPPA) und kein roter Faden durch die Nacht. Der Einfach-Modus gibt diesen Nutzern
eine Startseite, die die Nacht Schritt für Schritt führt, wie man es von der ASIAIR kennt
(Verbinden → Kühlen → Montierung → Fokus → Polausrichtung → Ziel → Guiding → Autorun → Nacht
beenden),
und eine Navigation mit nur den Einträgen, die man dafür braucht. Alle Funktionen bleiben
erreichbar, der Modus lässt sich jederzeit ausschalten.

## Scope

- Runtime modes: PINS. Auf NINA/Windows ist der Modus weder sichtbar noch wirksam.
- Surface: neue Route `/start` (Startseite des Modus), Navigation (Filter + Startseiten-Eintrag),
  Einstellungen → Oberfläche (Schalter), letzter Schritt des Setup-Assistenten (Angebot).
- Backends touched: keine. Alles läuft über vorhandene Endpoints (Advanced API, TNS-Plugin).

## Non-goals

- Keine neue Backend-Logik, kein neuer Endpoint, keine Änderung an NINA/PINS.
- Keine Automatik, die Hardware ohne Knopfdruck bewegt. Jeder Schritt startet nur auf Tippen.
- Die vorhandenen Seiten (Kamera, Framing, Sequenz, Montierung, Fokus, Guiding) ändern sich
  nicht. Der Modus verweist auf sie, statt sie nachzubauen.
- Die Navbar-Anpassung des Nutzers (Reihenfolge, versteckte Einträge) bleibt gespeichert und
  gilt wieder, sobald der Modus aus ist.
- Kein eigener Autorun-Editor: „Plan“ ist die vorhandene einfache Sequenzansicht.
- Kein PHD2 im Einfach-Modus: Guiding läuft über den in PINS eingebauten Guider. Wer PHD2
  behalten will, nutzt die Guiding-Seite oder schaltet den Modus aus.

## Acceptance criteria

1. Given eine PINS-Verbindung, when der Nutzer unter Einstellungen → Oberfläche den
   Einfach-Modus einschaltet, then zeigt die Navigation nur noch Start, Kamera (wenn
   verbunden), Ziel (Himmelsatlas), Plan und Einstellungen, in dieser Reihenfolge, und die App
   wechselt auf die Startseite. Ausschalten stellt die eigene Navbar-Anpassung unverändert
   wieder her.
2. Given eine NINA/Windows-Verbindung, then gibt es weder den Schalter noch den Startseiten-
   Eintrag, und eine gespeicherte Einschaltung verändert die Navigation nicht.
3. Given der Modus ist an, when die App startet und auf `/` oder `/equipment` landet, then
   öffnet sie die Startseite. Ein späterer Tipp auf „Alle Geräte“ bleibt auf `/equipment`.
4. Given die Startseite, then zeigt die Karte „Deine Ausrüstung“ jedes Gerät des Profils
   mit Klartext-Status (z. B. „Verbunden · −9,8 °C“, „Nicht verbunden“) innerhalb eines
   Poll-Zyklus (2 s). „Alles verbinden“ verbindet in derselben Reihenfolge wie die
   Geräteseite (gemeinsamer Code) und ist ausgegraut, wenn alles verbunden ist. Ohne Geräte
   im Profil erscheint ein Hinweis mit Knopf zum Setup-Assistenten.
4a. Given die Startseite, then steht oben das neueste Bild – die letzte Vorschau der Kamera
   oder das zuletzt gespeicherte Bild, je nachdem was neuer ist – mit Ziel, Belichtung, Filter
   und Alter, darunter HFR, Sterne, Guiding-RMS (nur während des Guidings) und
   Sensortemperatur sowie der HFR-Verlauf der letzten 30 gespeicherten Bilder. Neue Bilder
   eines laufenden Plans erscheinen über das vorhandene IMAGE-SAVE-Ereignis ohne neuen Poller.
   „Testbild aufnehmen“ belichtet mit der gewählten Zeit (gleiche Einstellung wie die
   Kameraseite), ein Tipp aufs Bild öffnet die Vollbildansicht mit Zoom. Auf dem Tablet
   stehen Bild und Ausrüstung links, die Schritte rechts.
4b. Given die Startseite, then richtet sie sich nach der Phase der Nacht (aus den Schritten
   abgeleitet): **Vorbereitung** (Aufnahme nicht gestartet) – Schritte vorn, auf dem Telefon
   die Ausrüstung davor, solange nicht alles verbunden ist. **Aufnahme läuft** – oben ein
   Cockpit mit Ziel, Fertig-Uhrzeit, aktueller Tätigkeit (Belichtung mit Bildnummer und
   Fortschritt, Autofokus, Schwenk, Kalibrieren, Settle) und drei Ampelkacheln: Guiding-RMS
   gegen den Abbildungsmaßstab (≤ 0,5 px gut, ≤ 1 px ok), HFR des neuesten Bildes gegen den
   Median der vorherigen im selben Filter (≤ +10 % gut, ≤ +25 % ok) und die Sternanzahl. Eine
   Sternform wird bewusst nicht geschätzt (NINA liefert keine Exzentrizität pro Bild), die
   Sterne sieht man im Bild. Darunter der RA/Dec-Verlauf des eingebauten Guiders (nur bei
   verbundenem Feed, sonst NINAs RMS aus dem 2-s-Polling) und Warnungen: Gerät
   getrennt, Stern verloren, Plan ohne Guiding, Guiding zu groß, HFR steigt, Sensor > 2 °C
   neben dem Kühlziel. Das Bild steht daneben (Tablet) bzw. darunter (Telefon), die Schritte
   sind zugeklappt, die Ausrüstung erscheint nur, wenn ein Gerät fehlt. **Plan fertig** und
   **Nacht beendet** – Bilanz der Nacht (Lights, Belichtungszeit, Median-HFR), bei „fertig“
   mit „Nacht beenden“ vorn, bei „beendet“ mit Park- und Aufwärmstatus.
4c. Given ein Bild im Bild-Panel (jede Phase), then zeigt es das Histogramm um den
   Himmelshintergrund (vom Plugin, `raw-image/prepared` bzw. `raw-image/history`, volle
   Auflösung) sowie Min und Max mit der Anzahl Pixel auf diesem Wert; Max am Sensorlimit ist
   als „gesättigt“ markiert. Ohne Raw-Endpoint (älteres Plugin) entfällt der Block.
5. Given die Startseite, then zeigt „Deine Nacht“ die Schritte Kamera kühlen (nur bei
   kühlbarer Kamera), Teleskop startklar, Scharfstellen, Polausrichtung, Ziel anfahren,
   Guiding, Aufnahme und Nacht beenden. Scharfstellen steht vor Polausrichtung und Ziel, weil
   beide per Plate-Solving arbeiten und dafür scharfe Sterne brauchen; solange Fokus offen ist,
   weisen beide Schritte darauf hin. Jeder Schritt zeigt
   „Erledigt“, „Läuft“, „Offen“ oder „Übersprungen“. Der erste offene Schritt ist
   hervorgehoben und aufgeklappt.
   5a. Was sich aus dem Gerätestatus ablesen lässt, wird abgeleitet: gekühlt = Kühler an und
   Zieltemperatur erreicht; startklar = verbunden, nicht geparkt, Nachführung an; Guiding =
   Guider-Status „Guiding“ (Kalibrieren = läuft); Aufnahme = Sequenz läuft; Scharfstellen =
   Autofokus läuft bzw. in dieser Nacht abgeschlossen.
   5b. Polausrichtung, Ziel und manuelles Scharfstellen lassen sich nicht ablesen: Der Nutzer
   markiert sie als erledigt oder überspringt sie. Die Markierung gilt für die laufende Nacht
   (12 Uhr bis 12 Uhr) und übersteht einen App-Neustart.
6. Given ein Schritt mit Aktion, when der Nutzer tippt, then passiert genau diese Aktion:
   Kühlen auf die eingestellte Temperatur, Entparken + Nachführung an, Polausrichtung öffnen
   (Montierung → TPPA), Himmelsatlas öffnen (dort Suchen, „Slew and Center“, „set to
   sequence target“; der Schritt bietet den Rig-Schalter „automatisch zentrieren“ an),
   Autofokus starten bzw. Kamera öffnen, Guiding starten/stoppen, Plan öffnen, Aufnahme
   starten/stoppen. Eine Ablehnung durch das Backend
   erscheint als Toast.
7. Given „Nacht beenden“, when der Nutzer bestätigt, then werden der Reihe nach nur die
   angehakten und zutreffenden Schritte ausgeführt: Aufnahme stoppen, Guiding stoppen,
   Montierung parken, Kamera aufwärmen. Jeder zeigt sein Ergebnis. Ohne Bestätigung passiert
   nichts.
8. Given der Schritt „Aufnahme“, then zeigt er Anzahl Ziele und Restdauer des geladenen Plans
   (gleiche Rechnung wie die einfache Sequenzansicht) bzw. „Noch kein Plan“, und führt in die
   einfache Sequenzansicht.
8a. Given der Schritt „Guiding“ und ein anderer Guider im Profil (PHD2, keiner), then bietet
   er „Eingebauten Guider verwenden“ an, wenn PINS ihn als Gerät führt (`InternalGuider`),
   sonst einen Update-Hinweis. Ohne Guidekamera im Profil zeigt er die Auswahl der Kameras
   (ohne die Hauptkamera). Beide Wahlen landen im Profil und werden per `rescan` an NINAs
   Geräteauswahl gegeben, damit „Alles verbinden“ (ohne `?to=`) das richtige Gerät verbindet.
   Starten kalibriert beim ersten Mal automatisch, ohne die Montierung wegzufahren.
9. Given der Setup-Assistent auf PINS, then bietet der letzte Schritt „Einfach“ oder „Alle
   Funktionen“ an. Die Wahl landet im selben Schalter wie in den Einstellungen.
10. Alle neuen Texte sind übersetzbar. Die reine Logik (Nachtschlüssel, Schrittstatus, Navbar-
    Filter) hat Unit-Tests. Startseite rendert bei 390 px und 1024 px ohne horizontalen
    Überlauf, in Android-WebView, iOS-WebView und Browser gleich (keine plattformspezifische
    API).

## Dimensions considered

| Dimension        | Applies | Note                                                                            |
| ---------------- | ------- | ------------------------------------------------------------------------------- |
| Runtime modes    | yes     | Nur PINS, über `store.isPINS` gegated                                           |
| Polling          | yes     | Kein neuer Poller für Geräte; Sequenzbaum per vorhandenem `sequenceV2Store`     |
| Mobile           | yes     | Karten mit `min-h-touch`, `tns-*`, keine Hover-Abhängigkeit                     |
| i18n             | yes     | Neue Texte erst in `en.json`, die anderen 13 Sprachen gesammelt vor dem Commit  |
| Equipment safety | yes     | Nur explizite Knopfdrücke; „Nacht beenden“ nur nach Bestätigung                 |
| Error paths      | yes     | Backend-Ablehnungen → Toast; Gerät weg → Schritt zeigt „Nicht verbunden“        |
| Native           | no      | Keine Capacitor-API                                                             |
| Persistence      | yes     | `settingsStore.simpleMode` (an/aus, Kühltemperatur, Nachtmarkierungen)          |
| Tests            | yes     | `src/utils/simpleMode.js` + Composable für „Alles verbinden“                    |

## Verification (2026-11-20)

Gegen PINS im Docker (lokales Image mit nativem Guider) und den Alpaca-Sky-Simulator:
Alles verbinden inkl. nativem Guider und Guidekamera, Entparken + Nachführung, Wechsel
PHD2 → eingebauter Guider, Guidekamera wählen, Kalibrieren starten (am Himmelspol korrekt
abgelehnt, deshalb der Hinweis „erst Ziel anfahren“), Atlas → M 31 → Slew and Center, Plan
mit Ziel und Belichtung anlegen, Aufnahme starten/stoppen mit Rückfrage, Autofokus starten,
Nacht beenden (Parken wartet auf „geparkt“), Testbild mit HFR/Sternen (Sternanalyse kommt
nach dem Bild, die Vorschau fragt bis zu sechsmal nach), neues gespeichertes Bild erscheint
live. `npm run test:browser` prüft `/start` bei 390 px
und 1024 px.

## Open questions

- Übersetzungen der 13 weiteren Sprachen: nach Freigabe in einem Batch.
- Der Feed-WebSocket des nativen Guiders nimmt im `vite dev` Port 8080 statt 5000 (REST
  biegt um, der Socket nicht). Betrifft nur die Entwicklung, nicht diesen Modus.
