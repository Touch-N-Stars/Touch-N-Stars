# Montierungstreiber finden (PINS)

Status: implemented, pending review
Date: 2026-11-21

## Goal

Wer z. B. eine Sky-Watcher EQ6-R Pro hat, findet den richtigen INDI-Treiber, indem er sein
Gerät eintippt („EQ6“) statt INDI-Treibernamen zu kennen. Heute sieht er nur eine Liste mit
INDI-Labels („EQMod Telescope“, „SynScan Telescope“), und die Suche nach „Skywatcher“ führt
zum falschen Treiber („Skywatcher AltAz“). Die App sagt, welcher Treiber zu seiner
Anschlussart passt, wählt ihn aus und installiert ihn bei Bedarf nach. Erster Schritt: nur
Montierungen, offline über eine kuratierte Tabelle in der App.

## Scope

- Runtime modes: PINS. INDI-Treiber gibt es nur dort; auf NINA/Windows ändert sich nichts.
- Surface: eine gemeinsame Komponente an drei Orten – Setup-Assistent (Montierungsschritt),
  Simple-Mode-Startseite (Karte „Deine Ausrüstung“), Geräteseite (INDI-Bereich Montierung).
- Backends touched: Advanced API (Profilwert, `list-devices`), Plugin `/api/indi/telescope`
  (Treiberliste), pinsdaemon `/packages/indi3rdparty` (Pakete nachinstallieren).

## Non-goals

- Keine weiteren Gerätetypen (Kamera, Fokussierer, Filterrad …) in diesem Schritt. Das
  Muster soll sie später aufnehmen können.
- Keine Online-Abfrage der Hardware-DB.
- Kein automatisches Verbinden und keine Bewegung der Montierung.
- NINA/Windows bleibt unverändert.
- Das volle INDI-Dropdown und das 3rd-party-Panel bleiben als Rückfallebene erreichbar.

## Acceptance criteria

1. Given PINS, when der Nutzer „EQ6“, „eq 6“, „EQ6-R“ oder „skywatcher eq6“ eingibt, then
   erscheint „Sky-Watcher EQ6-R Pro“ als Treffer – unabhängig von Groß-/Kleinschreibung,
   Leerzeichen, Bindestrichen und Herstellerschreibweise („Skywatcher“/„Sky-Watcher“), ohne
   Internet.
2. Given ein Treffer, then fragt er nach der Anschlussart in Alltagssprache (z. B. „USB-Kabel
   direkt an der Montierung“ → EQMod, „Über die SynScan-Handbox“ → SynScan). Jede Wahl nennt
   den Treiber und einen Satz, was angesteckt werden muss.
3. When der Nutzer „Diesen Treiber verwenden“ tippt, then läuft der Vier-Schritt-Wechsel
   (Profilwert → `list-devices` → Rescan → Profil neu laden), und innerhalb eines Poll-Zyklus
   (2 s) zeigt die Geräteauswahl die Montierung dieses Treibers. Verbinden bleibt ein eigener
   Tipp.
4. Given der passende Treiber ist nicht installiert, aber als 3rd-party-Paket verfügbar, then
   bietet der Treffer „Installieren und verwenden“. Nach Bestätigung ist der Fortschritt
   sichtbar, danach ist der Treiber gesetzt wie in 3. Ohne Internet erscheint ein Klartext-
   Hinweis, dass PINS dafür Internet braucht; die Wahl installierter Treiber funktioniert
   weiter.
5. Given kein Treffer, then zeigt die Suche „Nicht dabei?“ mit dem vollen INDI-Dropdown und
   dem vorhandenen 3rd-party-Panel – keine Sackgasse.
6. Given die Montierung ist verbunden, then ist der Treiberwechsel gesperrt mit Hinweis
   „erst trennen“. Kein Treiberwechsel verbindet oder bewegt die Montierung.
7. Dieselbe Komponente steht im Assistenten als Erstes hinter „Montierung nicht
   aufgeführt?“, auf der Geräteseite im INDI-Bereich der Montierung und auf der
   Simple-Mode-Startseite in „Deine Ausrüstung“, wenn keine Montierung im Profil ist oder das
   Verbinden fehlschlägt („Treiber finden“).
8. Die Modelltabelle (Hersteller, Modell, Suchbegriffe, Anschlussarten → Treibername, optional
   Paketname) ist eine reine Datendatei, die Suche eine Util-Funktion mit Unit-Tests
   (EQ6-Varianten, HEQ5, AZ-EQ6, Star Adventurer GTi, iOptron CEM, ZWO AM5, Celestron AVX/CGX,
   kein Treffer). Jeder Treibername der Tabelle ist einmal gegen die Treiberliste eines echten
   PINS geprüft. Die Oberfläche funktioniert bei 390 px und 1024 px ohne horizontalen
   Überlauf, mit 48-px-Tippflächen und neuen Texten nur in `en.json`, auf Android, iOS und im
   Browser gleich.

## Dimensions considered

| Dimension        | Applies | Note                                                                       |
| ---------------- | ------- | -------------------------------------------------------------------------- |
| Runtime modes    | yes     | Nur PINS, über `store.isPINS` gegated wie die vorhandene INDI-Auswahl      |
| Polling          | no      | Kein neuer Zustand; Gerätestatus kommt aus dem vorhandenen 2-s-Polling     |
| Mobile           | yes     | 390 px / 1024 px, `min-h-touch`, `tns-*`-Klassen                           |
| i18n             | yes     | Neue Texte erst in `en.json`, die 13 anderen Sprachen gesammelt vor Commit |
| Equipment safety | yes     | Wechsel gesperrt bei verbundener Montierung; kein Auto-Connect             |
| Error paths      | yes     | Kein Internet beim Installieren, Install-Job schlägt fehl, Treiber fehlt   |
| Native           | no      | Keine Capacitor-API                                                        |
| Persistence      | yes     | Wahl liegt im NINA-Profil, übersteht `clearAllStates()` und Instanzwechsel |
| Tests            | yes     | Tabelle + Suchfunktion als Util mit Unit-Tests                             |

## Verification (2026-11-21)

Gegen den PINS-Pi (192.168.2.129, Plugin aus dem nitr57-Fork), Frontend-Build eingespielt:

- Geräteseite → INDI Setup → „Find mount driver“: „eq 6“ liefert EQ6-R Pro, EQ6 Pro, AZ-EQ6.
  EQ6-R Pro → USB direkt → EQMod fehlte auf dem Pi → „Install and use“ → Bestätigung →
  `indi-eqmod` installiert, Registry-Eintrag `telescope`, Profil danach
  `EQMod Mount / indi_eqmod_telescope`, Geräteliste zeigt „EQMod Mount (INDI)“ statt OFFLINE.
- Gleiche Stelle bei 1024 px: SynScan-Handbox (installierter Treiber) → Profil
  `SynScan / indi_synscan_telescope`, Dropdown zieht nach.
- Simple-Mode-Startseite ohne Montierung im Profil: Karte bietet „Find mount driver“, ZWO AM5
  gesetzt, danach steht „Mount“ in der Karte und der Hinweis verschwindet.
- Setup-Assistent, Montierungsschritt: HEQ5 Pro → EQMod, die Geräteauswahl zeigt sofort
  „EQMod Mount (INDI)“.
- 390 px und 1024 px ohne horizontalen Überlauf, keine Seitenfehler; `npm run test:browser`
  grün.

Befunde dabei:

- Nur `rescan` startet einen neuen INDI-Treiber, `list-devices` liefert die alte Liste. Der
  Profileintrag des alten Geräts erscheint danach als OFFLINE, deshalb schreibt
  `applyIndiDriver` das neue Gerät ins Profil. Das ältere `IndiDriverSelect` (Fallback-Liste)
  ruft weiter nur `list-devices` und lässt das alte Gerät im Profil stehen.
- Ohne Internet antwortet der pinsdaemon auf die Paketliste mit 502; der Finder zeigt dafür
  einen eigenen Hinweis. Das vorhandene 3rd-party-Panel zeigt in dem Fall nur „keine Treiber“.
- Das Install-Skript liest die Treiber-XML nicht (es sucht Attribute, die es dort nicht gibt)
  und filtert nach Paketnamen: aus `indi-eqmod` wird nur `indi_eqmod_telescope` eingetragen,
  `indi_staradventurergti_telescope`/`indi_azgti_telescope` nicht. Die Tabelle nutzt deshalb
  EQMod auch für Star Adventurer GTi.

## Open questions

- Erledigt: Ein nachinstallierter Treiber erscheint in `/api/indi/telescope` – der Fork
  übernimmt `3rdparty.json` unter dem bei der Installation angegebenen Typ.
- SynScan-WLAN (EQMod über UDP, 192.168.4.1:11880): nicht umgesetzt, die Tabelle bietet nur
  Kabelverbindungen. Bräuchte `IndiConnectionMode`/`IndiAddress`/`IndiPort` im Profil und einen
  Test mit echter Montierung.
- Modellliste: 34 Einträge (Sky-Watcher, Celestron, iOptron, ZWO, Astro-Physics, Bresser,
  Explore Scientific, Losmandy, Meade, 10Micron, OpenAstroTech, OnStep, Pegasus, Rainbow,
  Takahashi, Vixen). Treibernamen gegen den Pi geprüft; ob jede Modell-Treiber-Zuordnung mit
  echter Hardware verbindet, ist nur für die Treiberwahl, nicht für die Verbindung belegt.
- Übersetzungen der 13 weiteren Sprachen: nach Freigabe in einem Batch.
