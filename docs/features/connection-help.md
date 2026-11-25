# Verbindungshilfe

Status: implemented, pending review
Date: 2026-11-25

## Goal

Findet die App PINS oder NINA nicht, versteht auch ein Anfänger, woran es liegt und was er als
Nächstes tut. Heute erscheint für fast jede Ursache „Das Touch'N'Stars-Plugin ist nicht verfügbar,
prüfe die Einstellungen in NINA“. Die App sucht außerdem weiter, solange keine Verbindung steht,
und verbindet sich mit dem bekannten Rig von selbst, auch unter neuer Adresse.

## Scope

- Runtime modes: NINA und PINS, nicht nur Einfach-Modus (die Seite erscheint, bevor der Modus
  bekannt ist).
- Surface: Verbindungsseite (Splash in `App.vue`), nur solange das Backend nicht erreichbar ist.
- Backends touched: pinsdaemon `:8000/health` (lesen), Plugin `/api/version` (lesen), mDNS. Kein
  neuer Endpoint.

## Non-goals

- Keine Änderung am 2-s-Polling, an der Resume-Logik und an der Reload-Strategie bei
  Instanzwechsel.
- Kein automatischer Wechsel zu einem fremden Rig oder NINA-Rechner.
- Keine Netzsuche im Browser (technisch nicht möglich).
- Einstellungsseite der Instanzen und Einrichtungsassistent bleiben, wie sie sind.

## Acceptance criteria

1. Given kein Backend, when höchstens 3 s vergangen sind, then zeigt die Seite nur „Verbinde…“;
   danach bis 15 s „Verbinde mit {Name}“. Ein kurzer Aussetzer zeigt also keine Fehlerhilfe.
2. Given ein PINS-Rig, das nach 15 s nicht antwortet, then nennt die Seite Strom/Startzeit, das
   WLAN des Rigs mit Namen und Standardpasswort und das gemeinsame Heimnetz; bei einem NINA-Rechner
   stattdessen Rechner/NINA, gemeinsames Netz, Plugin und Firewall; ist die Art unbekannt, beides.
   Es gibt keinen roten Toast über der Seite.
3. Given der pinsdaemon antwortet an der Adresse, PINS aber nicht, then sagt die Seite „Rig ist an,
   PINS startet noch“ und nach 2 Minuten, dass PINS nicht antwortet, mit einem Rat.
4. Given ein Backend mit fehlender Advanced API oder zu alter Version, then nennt die Seite genau
   das, bei der Version mit vorhandener und nötiger Nummer.
5. Given das Rig der gewählten Instanz (gleiche `rigId`) antwortet unter einer anderen bekannten
   oder per mDNS gefundenen Adresse oder an seinem Hotspot, then verbindet sich die App ohne Tippen
   dorthin, auch noch Minuten nach dem Abriss.
6. Given nur ein anderes Rig oder ein anderer NINA-Rechner wird gefunden, then bietet die Seite ihn
   mit Namen und Adresse an; erst ein Tippen wechselt. Ein schon gespeichertes Rig wird nicht
   doppelt angelegt.
7. Given Android im WLAN des Rig-Hotspots mit mobilen Daten und einer gespeicherten Adresse aus
   einem anderen Netz, then läuft die Suche am Hotspot über das WLAN; die vorherige WLAN-Bindung
   wird danach wiederhergestellt. Mit ausgeschalteter WLAN-Bindung bleibt alles wie bisher.
8. Given ein als NINA bekanntes Backend, then fragt die Suche weder dessen Port 8000 noch den
   Hotspot ab. Given die App liegt im Hintergrund oder ein Netzwechsel des Rigs läuft, then sucht
   sie nicht.
9. Given iOS, then ist `_pinsdaemon._tcp` in `NSBonjourServices` eingetragen, und die Checkliste
   nennt die Freigabe „Lokales Netzwerk“ (eine verweigerte Freigabe meldet iOS der App nicht).
10. Given „Erneut suchen“, then startet sofort ein Verbindungsversuch und eine Suche, ohne dass die
    Hilfe verschwindet. Adresse und Einstellungen stehen unter „Erweitert“.
11. Given die Seite kann nicht erscheinen (Einstellungsseite, Assistent), then kommt einmal je
    Abriss ein Toast; er verweist bei einem stummen Backend nicht auf Plugin-Einstellungen.

## Dimensions considered

| Dimension        | Applies | Note                                                                                |
| ---------------- | ------- | ----------------------------------------------------------------------------------- |
| Runtime modes    | ja      | Art aus `rigId` oder der letzten Erkennung je Instanz, sonst unbekannt              |
| Polling          | ja      | Suche über `useBackgroundAwarePolling`, nur solange die Seite sichtbar ist          |
| Mobile           | ja      | Seite scrollt, Safe Areas, 48-px-Ziele, Hoch- und Querformat                        |
| i18n             | ja      | Neue Schlüssel in `en.json`, die 13 Sprachen gesammelt nach Rückfrage               |
| Equipment safety | nein    | Nur lesende Abfragen, kein Hardwarebefehl                                           |
| Error paths      | ja      | Kern des Features                                                                   |
| Native           | ja      | Android-WLAN-Bindung, iOS-Bonjour; die Info.plist braucht ein neues App-Store-Build |
| Persistence      | ja      | Art je Instanz gespeichert; Suchergebnis nur flüchtig                               |
| Tests            | ja      | Diagnose und Suche als reine Logik, Browser-Test der Seite                          |

## Open questions

- Prüfung an echten Handys (Android mit mobilen Daten am Hotspot, iOS-Freigabe): Johannes.

## Verification (2026-11-25)

Gebaute App im Browser gegen das Schein-Backend (Telefon hoch, Querformat): NINA still, PINS still,
Rig an ohne PINS (startend und nach 2 min), fremdes Rig gefunden und angetippt (kein doppelter
Eintrag), eigenes Rig am Hotspot ohne Tippen übernommen, fehlende Advanced API, alte Version,
unbekannte Art, Toast auf der Einstellungsseite nach 15 s. Suche und Diagnose als Unit-Tests, die
Seite im Browser-Test. Nicht geprüft: Android-WLAN-Bindung, mDNS und iOS-Freigabe an echten Handys,
ein echtes Rig.
