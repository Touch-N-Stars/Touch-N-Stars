# Einfach-Modus für PINS

Status: implemented, pending review
Date: 2026-11-20

## Goal

Wer von der ASIAIR auf PINS umsteigt und technisch nicht so bewandert ist, findet sich in TNS
heute nicht zurecht: 15+ Navigationseinträge, Fachbegriffe aus NINA (Framing, Sequenz,
Trigger, TPPA) und kein roter Faden durch die Nacht. Der Einfach-Modus gibt diesen Nutzern
eine Startseite, die die Nacht Schritt für Schritt führt, wie man es von der ASIAIR kennt
(Verbinden → Kühlen → Montierung → Fokus → Polausrichtung → Guiding einrichten → Ziel →
Autorun → Nacht beenden),
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
  Anfahren, Zentrieren und Guiding-Start am Ziel übernimmt der Plan; sie laufen erst nach
  „Aufnahme starten“ und dessen Bestätigung, die genau das ankündigt.
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
   neben dem Kühlziel. Was ein Ziel vor seinen Bildern tut (anfahren, zentrieren, Guiding
   starten) und das Parken und Aufwärmen am Ende nennt das Cockpit aus den Schritten des Plans;
   „ohne Guiding“ warnt es erst danach, nicht beim Zentrieren. Das Bild steht daneben (Tablet) bzw. darunter (Telefon), die Schritte
   sind zugeklappt, die Ausrüstung erscheint nur, wenn ein Gerät fehlt. **Plan fertig** und
   **Nacht beendet** – Bilanz der Nacht (Lights, Belichtungszeit, Median-HFR), bei „fertig“
   mit „Nacht beenden“ vorn, bei „beendet“ mit Park- und Aufwärmstatus.
   4c. Given ein Bild im Bild-Panel (jede Phase), then zeigt es das Histogramm um den
   Himmelshintergrund (vom Plugin, `raw-image/prepared` bzw. `raw-image/history`, volle
   Auflösung) sowie Min und Max mit der Anzahl Pixel auf diesem Wert; Max am Sensorlimit ist
   als „gesättigt“ markiert. Ohne Raw-Endpoint (älteres Plugin) entfällt der Block.
5. Given die Startseite, then zeigt „Deine Nacht“ die Schritte Kamera kühlen (nur bei
   kühlbarer Kamera), Teleskop startklar, Scharfstellen, Polausrichtung, Guiding einrichten,
   Ziel wählen, Aufnahme und Nacht beenden. Scharfstellen steht vor Polausrichtung und Ziel,
   weil beide per Plate-Solving arbeiten und dafür scharfe Sterne brauchen; solange Fokus offen
   ist, weist die Polausrichtung darauf hin. Jeder Schritt zeigt
   „Erledigt“, „Läuft“, „Offen“ oder „Übersprungen“. Der erste offene Schritt ist
   hervorgehoben und aufgeklappt.
   5a. Was sich aus dem Gerätestatus ablesen lässt, wird abgeleitet: gekühlt = Kühler an und
   Zieltemperatur erreicht; startklar = verbunden, nicht geparkt, Nachführung an; Guiding
   eingerichtet = eingebauter Guider und Guidekamera gewählt und der Guider meldet eine
   Kalibrierung (Kalibrieren = läuft); Ziel = der Plan hat ein Ziel mit Objekt oder
   Koordinaten; Aufnahme = Sequenz läuft; Scharfstellen = Autofokus läuft bzw. in dieser Nacht
   abgeschlossen.
   5b. Polausrichtung und manuelles Scharfstellen lassen sich nicht ablesen: Der Nutzer
   markiert sie als erledigt oder überspringt sie. Die Markierung gilt für die laufende Nacht
   (12 Uhr bis 12 Uhr) und übersteht einen App-Neustart.
6. Given ein Schritt mit Aktion, when der Nutzer tippt, then passiert genau diese Aktion:
   Kühlen auf die eingestellte Temperatur, Entparken + Nachführung an, Polausrichtung öffnen
   (Montierung → TPPA), Himmelsatlas öffnen, Autofokus starten bzw. Kamera öffnen, Guider
   einmal kalibrieren, Plan öffnen, Aufnahme starten/stoppen. Eine Ablehnung durch das Backend
   erscheint als Toast.
   6c. Given der Schritt „Kamera kühlen“ und ein Profil, dessen Kühl-/Aufwärmzeit
   (`CameraSettings-CoolingDuration` / `-WarmingDuration`) zu keiner Stufe passt und für das
   noch nicht gewählt wurde, then fragt er statt des Kühlknopfs einmal, wie schnell die Kamera
   kühlen darf: Schnell (0 / 5 min), Sanft (5 / 10), Sehr sanft (10 / 15). Die Wahl landet im
   NINA-Profil, damit Auto-Kühlen beim Verbinden und die Kameraseite dieselben Werte nutzen.
   Eigene Werte (nicht NINAs 0 / 0) lassen sich mit einem Tipp behalten. Danach kühlt der
   Schritt mit der Profilzeit statt fest 10 min, „Nacht beenden“ wärmt mit der Profilzeit
   (ohne eigene Zeit 10 min) und zeigt sie an.
   6a. Given der Himmelsatlas im Einfach-Modus, then steht „In den Plan“ als Hauptknopf vorn,
   „Slew and Center“ ist mit dem Hinweis versehen, dass Anfahren nur zum Prüfen des
   Bildausschnitts nötig ist. „In den Plan“ setzt das Ziel (Auswahl neu/ersetzen/kopieren wie
   bisher) und schaltet für dieses Ziel Zentrieren (mit verbundenem Rotator: Zentrieren und
   Drehen) und „Guiding starten“ ein – Letzteres nicht, wenn der Guiding-Schritt übersprungen
   wurde. Hat das Profil Fokussierer und Filterrad, bekommt das Ziel außerdem den Trigger
   „Autofokus nach Filterwechsel“ (wird nur ein-, nie ausgeschaltet). Ein Ziel ohne Belichtung bekommt eine Belichtungszeile. Der Plan bekommt
   außerdem am Ende „Montierung parken“ und, bei verbundener Kühlkamera, „Kamera aufwärmen“
   (ebenfalls nur ein-, nie ausgeschaltet; eine neu angelegte Aufwärmzeile bekommt die Zeit von
   „Nacht beenden“). Geparkt wird vor dem Aufwärmen. Danach schließt der Atlas
   und die Startseite erscheint.
   6b. Given der Schritt „Ziel wählen“, then listet er die Ziele des Plans. Ist der Guider noch
   nicht kalibriert und steht das nächste Ziel über 60° Deklination oder unter 30° Höhe
   (Grenzen des Guiding-Coach), then weist er darauf hin, vorher einmal zu kalibrieren.
7. Given „Nacht beenden“, when der Nutzer bestätigt, then werden der Reihe nach nur die
   angehakten und zutreffenden Schritte ausgeführt: Aufnahme stoppen, Guiding stoppen,
   Montierung parken, Kamera aufwärmen. Jeder zeigt sein Ergebnis. Ohne Bestätigung passiert
   nichts.
8. Given der Schritt „Aufnahme“, then zeigt er Anzahl Ziele und Restdauer des geladenen Plans
   (gleiche Rechnung wie die einfache Sequenzansicht) bzw. „Noch kein Plan“, und führt in die
   einfache Sequenzansicht. Ziele mit offenen Bildern, die der Plan nicht anfährt oder (bei
   eingerichtetem Guiding) nicht guidet oder (mit Fokussierer und Filterrad) nach einem
   Filterwechsel nicht neu fokussiert, meldet er mit einem Knopf, der das für alle nachholt.
   Ohne Ziel mit Koordinaten lässt sich die Aufnahme nicht starten.
   8e. Given ein Plan mit offenen Bildern, der am Ende nicht parkt (oder mit verbundener
   Kühlkamera nicht aufwärmt), then warnt „Aufnahme“, dass die Montierung nach dem Plan weiter
   nachführt und ohne Aufsicht gegen Stativ oder Säule laufen kann, mit einem Knopf, der die
   fehlenden Schritte einschaltet. Die Rückfrage vor dem Start nennt, was nach dem letzten Bild
   passiert (parken, aufwärmen, beides oder weiter nachführen). Anfahren, Zentrieren und Guiding
   nennt sie so, wie sie im Plan stehen, auch wenn sie dort (bei einem oder allen Zielen)
   abgeschaltet sind.
   8a. Given der Schritt „Guiding“ und ein anderer Guider im Profil (PHD2, keiner), then bietet
   er „Eingebauten Guider verwenden“ an, wenn PINS ihn als Gerät führt (`InternalGuider`),
   sonst einen Update-Hinweis. Ohne Guidekamera im Profil zeigt er die Auswahl der Kameras
   (ohne die Hauptkamera). Beide Wahlen landen im Profil und werden per `rescan` an NINAs
   Geräteauswahl gegeben, damit „Alles verbinden“ (ohne `?to=`) das richtige Gerät verbindet.
   Ohne Kalibrierung bietet er „Einmal kalibrieren“ an: nach Rückfrage schwenkt die Montierung
   wie beim Kalibrier-Assistenten an die Kalibrierposition der aktuellen Seite (Himmelsäquator,
   5° neben dem Meridian, kein Flip), kalibriert und stoppt das Guiding danach wieder. PINS
   behält die Kalibrierung über Nächte und passt sie an Deklination und Pierseite an; der
   Schritt bleibt erledigt, bis PINS sie verwirft (andere Guidekamera, Binning, Brennweite).
   Einen Start/Stopp-Knopf gibt es nicht mehr, das Guiding startet der Plan am Ziel.
   8f. Given ein Plan ohne offene Bilder, von dem in der laufenden Nacht keines gespeichert wurde
   (LIGHT, DARK, BIAS in der Bildhistorie), then gilt er als aufgebraucht: „Ziel wählen“ und
   „Aufnahme“ sind offen, die Startseite zeigt die Vorbereitung, und beide Schritte bieten
   „Nochmal aufnehmen“ an (setzt den Plan zurück). Solange die Historie unbekannt ist, bleibt er
   „erledigt“. Ohne offene Bilder lässt sich die Aufnahme nicht starten.
   8g. Given ein Plan, der schon bis in den Endbereich gelaufen ist, when er (auf der Startseite
   oder im Plan) wieder gestartet wird, then werden vorher Start- und Endschritte zurückgesetzt.
   PINS führt nur Schritte mit Status CREATED aus und ließ sonst „Montierung parken“ aus. Jeder
   Schritt wird einzeln zurückgesetzt, das Plugin auf PINS nimmt die folgenden nicht mit. Lehnt
   das Backend das ab, startet der Plan nicht.
   8i. Given ein gestoppter Plan mit offenen Bildern, when er wieder gestartet wird, then fährt er
   das Ziel erneut an, zentriert und startet das Guiding; der Fortschritt der Belichtungen bleibt.
   Dafür werden je Ziel mit offenen Bildern das Ziel selbst, seine Anfahrt-, Guiding- und
   Autofokus-Schritte und Filterwechsel/Belichtung der offenen Zeilen einzeln wieder geöffnet,
   dazu Kühlen und Entparken. Auch Bilder, die an ein fertiges Ziel angehängt wurden, laufen so.
   8j. Given ein fertiger oder abgebrochener Belichtungseintrag, dessen Anzahl über die schon
   aufgenommenen Bilder hinaus erhöht wurde (20 → 25), then zählt der Einfach-Modus die fehlenden
   Bilder als verbleibend und nimmt sie beim nächsten Start auf. Außerhalb des Einfach-Modus
   bleibt die Zeile fertig, dort öffnet der Start nichts wieder.
   8k. Given „In den Plan“ oder „Automatisch anfahren und guiden“, then bekommt der Plan, was ihm
   davon fehlt: „Auf Dunkelheit warten“ im Startbereich (`WaitForSunAltitude`, Vorgabe −12°, in
   hellen Sommernächten −9° oder −6°, nie dunkel: gar nicht) vor dem Entparken, davor Nachführung
   aus und danach wieder an; am Ziel das Ende bei Dämmerung (`SunAltitudeCondition`) und unter 20°
   Höhe (`AltitudeCondition`). Beide brauchen am Ziel eine `LoopCondition` mit 1, weil eine
   Bedingung in NINA sonst „wiederhole, solange“ heißt: So endet das Ziel nach seiner Anzahl oder
   an der Grenze. Hat ein Ziel schon eigene Bedingungen, kommt keine Schleife dazu. Was der Nutzer
   im Plan unter „Night“ ausgeschaltet hat, bleibt aus, auch für weitere Ziele. Beginn und Ende
   haben je eine eigene Auswahl mit Uhrzeit; das Ende liegt nie dunkler als der Beginn, weil NINAs
   Bedingung Abend und Morgen nicht unterscheidet und das Ziel sonst sofort endet. „Ziel hinzufügen“
   im leeren Plan setzt dieselben Schritte und Grenzen. Ohne Ziel sind die Schalter der
   Zielgrenzen gesperrt und sagen warum, ebenso während ein Ziel läuft.
   8l. Given ein Plan mit diesen Grenzen, then nennen „Aufnahme“ und der Plan, wann er beginnt,
   wann er spätestens endet und wie viele der Bilder in die Nacht passen; wird es nicht so dunkel,
   warnen sie. Die Startabfrage nennt die Wartezeit, das Cockpit zeigt „wartet auf Dunkelheit“ und
   warnt solange nicht vor fehlendem Guiding.
   8m. Given ein Plan, den Dämmerung oder Höhe vor dem letzten Bild beendet hat, then zeigt die
   Startseite die Bilanz mit „x von y Bildern“ statt der Vorbereitung. Ab der nächsten Nacht ist
   „Aufnahme“ wieder offen, der Start setzt die 1er-Schleife zurück und nimmt den Rest auf.
   8n. Given ein neues Ziel ohne Bilder, then beginnt es mit einer Stunde Aufnahmezeit: 120 s mit
   Guiding, 60 s ohne. Auf der Zielkarte rechnet „Wie lange willst du aufnehmen?“ eine Zeit in die
   Anzahl je Filter um (gleiche Zeit pro Filter, schon Aufgenommenes bleibt), dazu „So lange die
   Nacht reicht“. Eine weitere Belichtung übernimmt Zeit und Anzahl der letzten.
   8h. Given ein Plan, der schon geparkt und aufgewärmt hat, then lässt sich die Nacht trotzdem
   beenden: der Dialog hat ohne Aktionen nur die Bestätigung. Ist die Montierung nicht verbunden,
   behauptet er nicht, sie sei geparkt.
   8o. Given eine beendete Nacht, then bietet die Bilanz „Rig herunterfahren“ an, ebenso der Dialog
   „Nacht beenden“ nach vollem Erfolg ohne Aufwärmen. Solange die Kamera aufwärmt oder die
   Montierung nicht geparkt ist, tritt der Knopf zurück und ein Hinweis sagt, worauf zu warten
   ist; laufende Flats sperren ihn. Der Knopf öffnet die vorhandene Rückfrage mit ihrer
   Rig-Prüfung. Nimmt die Box das Herunterfahren an, sagt der Dialog, wann der Strom weg darf, und
   bleibt stehen, auch wenn die Verbindung abreißt. Lehnt sie ab, steht der Grund im Dialog.
   8b. Given eine Nacht, in der der Plan mindestens 15 min geguidet hat und davon mindestens 30 %
   mit roter Guiding-Ampel, then empfehlen die Bilanz und die nächste Vorbereitung den
   Guiding-Coach (≈ 15 min) mit Knopf zum Coach-Tab (`/guider?tab=coach`). Öffnen oder
   „Jetzt nicht“ blendet die Empfehlung für diese Nacht aus. Während der Plan läuft, wird der
   Coach nie angeboten.
   8c. Given ein Profil, dessen Meridian-Flip-Zeiten keinem Preset entsprechen und die auf diesem
   Gerät nicht bestätigt wurden, then zeigt „Vor deiner ersten Nacht“ die Preset-Frage der
   Flip-Einstellungen (ohne „Eigene Werte“) und „Diese Zeiten behalten“. Eine Wahl schreibt wie
   in den Einstellungen ins Profil, bestätigt den Flip für dieses Profil
   (`settingsStore.simpleMode.flipSetupProfiles`) und blendet den Punkt aus – er ist eine
   einmalige Einrichtung, kein Schritt der Nacht. Ein Preset im Profil gilt auch ohne
   Bestätigung als eingerichtet.
   8d. Given „In den Plan“ oder ein Plan ohne aktiven `MeridianFlipTrigger`, then schaltet
   „In den Plan“ ihn mit ein, und „Aufnahme“ warnt bei offenen Bildern mit einem Knopf, der ihn
   einschaltet. Mit Trigger sagt „Aufnahme“, welches Ziel wann den Meridian erreicht und in
   welchem Fenster der Plan umschwenkt (aus RA, Längengrad, geschätzten Zielzeiten und den
   Flip-Zeiten), sonst „kein Flip nötig“, plus Link zu Flip-Einstellungen und Tagestest.
   Während der Trigger läuft, zeigt das Cockpit „Meridian-Flip“ statt „Guiding läuft nicht“.
9. Given der Setup-Assistent auf PINS, then bietet der letzte Schritt „Einfach“ oder „Alle
   Funktionen“ an. Die Wahl landet im selben Schalter wie in den Einstellungen.
10. Alle neuen Texte sind übersetzbar. Die reine Logik (Nachtschlüssel, Schrittstatus, Navbar-
    Filter) hat Unit-Tests. Startseite rendert bei 390 px und 1024 px ohne horizontalen
    Überlauf, in Android-WebView, iOS-WebView und Browser gleich (keine plattformspezifische
    API).

## Dimensions considered

| Dimension        | Applies | Note                                                                                                               |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Runtime modes    | yes     | Nur PINS, über `store.isPINS` gegated                                                                              |
| Polling          | yes     | Kein neuer Poller für Geräte; Sequenzbaum per vorhandenem `sequenceV2Store`                                        |
| Mobile           | yes     | Karten mit `min-h-touch`, `tns-*`, keine Hover-Abhängigkeit                                                        |
| i18n             | yes     | Neue Texte erst in `en.json`, die anderen 13 Sprachen gesammelt vor dem Commit                                     |
| Equipment safety | yes     | Nur explizite Knopfdrücke; „Nacht beenden“ nur nach Bestätigung                                                    |
| Error paths      | yes     | Backend-Ablehnungen → Toast; Gerät weg → Schritt zeigt „Nicht verbunden“                                           |
| Native           | no      | Keine Capacitor-API                                                                                                |
| Persistence      | yes     | `settingsStore.simpleMode` (an/aus, Kühltemperatur, Kühlzeit gewählt je Profil, Nachtmarkierungen, Guiding-Bilanz) |
| Tests            | yes     | `src/utils/simpleMode.js` + Composable für „Alles verbinden“                                                       |

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

## Verification (2026-11-21, Plan übernimmt Anfahren und Guiding)

Gegen PINS im Docker mit Sky-Simulator: Kalibrier-Assistent mit `slew=stay` schwenkt von
Dec 89° an die Kalibrierposition (Dec 0°, gut 4° östlich des Meridians), kalibriert in ~2 min
und guidet danach; Stopp per API. Plan mit Anfahren, „Guiding starten“ und Belichtung vor
dem Ziel M 15: nach dem Schwenk startet das Guiding mit der gespeicherten Kalibrierung ohne
Neukalibrierung, danach läuft die Belichtung. Zentrieren ließ sich im Container nicht prüfen
(keine ASTAP-Datenbank: „No star database found“). Unit-Tests für Schrittlogik,
Zielprüfung, Guiding-Bilanz und `applySimpleTargetSteps`; `npm run test:browser` grün.
Die UI-Abläufe (Atlas → „In den Plan“, Kalibrier-Knopf mit Auto-Stopp, Coach-Hinweis) sind
noch nicht im echten Browser gegen PINS durchgeklickt.

## Verification (2026-11-22, Meridian-Flip)

Gegen PINS im Docker: Profil mit 5/10/0 zeigt den Punkt, „Behalten“ blendet ihn ohne
Profiländerung aus, „Ein paar Minuten“ schreibt 0/5/15, Recenter und UseSideOfPier = true
(Montierung meldet `pierEast`). Plan ohne GlobalTriggers → Warnung → Knopf legt den Trigger an;
deaktivierter Trigger → Atlas „In den Plan“ (M 42) schaltet ihn wieder ein. Vorhersage für M 42
(Transit 01:37) mit Python gegengerechnet. Der Flip selbst (Cockpit-Text) lief nicht durch.

## Verification (2026-11-25, Anzahl und Grenzen der Nacht)

Gegen den Test-Pi mit Simulatoren, über die Oberfläche: Schalter legen die Schritte richtig an,
vorhergesagte Dunkelheit 17:38 wie in PINS. Plan wartet mit stehender Nachführung, Stopp und
Neustart, Anfahren und Belichten mit einmaliger Schleife, „Dämmerung“ (Grenze per API verschoben)
beendet das Ziel und parkt, Bilanz „3 von 40“, zweiter Lauf entparkt, fährt an und nimmt den Rest
auf, danach 12 → 15 Bilder mit drittem Lauf. Über die API mit drei Zielen: Das untergehende wird
übersprungen, die anderen laufen. Nicht geprüft: echte Dämmerung über Nacht, mehrere Filter,
Meridian-Flip und Guiding zusammen mit den Grenzen, der Weg über den Atlas, echte Geräte. Bewusst
nicht abgefangen: ein noch tiefes, aber aufgehendes Ziel (NINAs Höhenbedingung lässt es laufen).

## Verification (2026-11-25, Herunterfahren)

Gebaute App gegen das Schein-Backend, Telefongröße: Nacht beenden mit Parken → Knopf im Dialog →
Rückfrage; Ablehnung zeigt den Grund und kehrt zur Rückfrage zurück; nicht geparkte Montierung
warnt; Annahme zeigt den Hinweis zum Strom, der nach Wegfall des Backends stehen bleibt. Nicht
geprüft: das wirkliche Herunterfahren einer Box, eine aufwärmende Kamera.

## Open questions

- Übersetzungen der 13 weiteren Sprachen: nach Freigabe in einem Batch.
- Der Feed-WebSocket des nativen Guiders nimmt im `vite dev` Port 8080 statt 5000 (REST
  biegt um, der Socket nicht). Betrifft nur die Entwicklung, nicht diesen Modus.
