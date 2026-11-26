# Einfach-Modus: Startseite als Bühne

Status: in progress
Date: 2026-11-26

## Goal

Im Einfach-Modus gab es zwei „Zuhause“: die Startseite mit den Schritten und einem kleinen Bild
weit unten, und die Kamera-Seite mit großem Bild und Expertenleiste. Wer fokussieren oder ein
Testbild ansehen wollte, musste scrollen oder die Seite wechseln. Die Startseite wird deshalb in
jeder Phase der Nacht zur Bühne, wie das Cockpit während des Plans: Das Bild füllt den
Bildschirm, darüber schwebt eine Leiste mit dem aktuellen Schritt. Die Kamera-Seite verschwindet
aus der Navigation des Modus.

## Scope

- Runtime modes: PINS (nur dort gibt es den Einfach-Modus).
- Surface: `/start` in den Phasen Vorbereitung, Plan fertig und Nacht beendet; Navigation des
  Modus. Das Cockpit (Plan läuft) behält sein Verhalten.
- Backends touched: keine.

## Non-goals

- Polausrichtung und Zentrieren bleiben, wo sie sind (eigene Seite bzw. NINA-Dialog).
- Keine Änderung an der Kamera-Seite selbst; sie bleibt über ihre Route erreichbar.
- Keine neue Logik der Schritte (`nightSteps`, Phasen, Markierungen).

## Acceptance criteria

1. Given der Einfach-Modus ist an, then zeigt die Navigation Start, Ziel, Plan und
   Einstellungen, ohne Kamera.
2. Given `/start` in Vorbereitung, Plan fertig oder Nacht beendet, then füllt das neueste Bild die
   Bühne (Zoom mit zwei Fingern wie im Cockpit), oben steht ein Chip mit Bildangaben und dem
   Fortschritt der Nacht, und unten schwebt die Leiste. Ohne Bild sagt die Bühne, was zu tun ist
   (Kamera verbinden bzw. Testbild aufnehmen).
3. Given die Leiste in der Vorbereitung, then zeigt sie zusammengeklappt den Testbild-Knopf (bei
   verbundener Kamera) und den aktuellen Schritt mit seinen Knöpfen, darunter „Alle Schritte“.
   Aufgeklappt zeigt sie alle Schritte, Kamerawerte, Schärfeverlauf, Histogramm und „Mehr“.
4. Given Plan fertig oder Nacht beendet, then führt die Leiste mit der Bilanz (und den Flats,
   solange sie offen sind); die Schritte und der Rest stehen aufgeklappt darunter.
5. Given der Schritt „Ausrüstung verbinden“, then enthält er die Geräteliste mit „Alles
   verbinden“. Eine eigene Ausrüstungskarte gibt es nur noch, wenn nach der Vorbereitung ein
   Gerät fehlt.
6. Given ein Profil ohne Motorfokussierer, then startet „Fokus von Hand“ fortlaufende Testbilder
   auf der Bühne, statt die Kamera-Seite zu öffnen; „Belichtung stoppen“ beendet sie. Autofokus,
   Polausrichtung und Aufnahmestart beenden laufende Testbilder vorher.
7. Given etwas läuft (Testbild, Autofokus, Kalibrierung, Schwenk), then nennt der Chip es in
   einer zweiten Zeile.
8. Bühne und Leiste haben bei 390 px und 1024 px keinen horizontalen Überlauf; Android-WebView,
   iOS-WebView und Browser verhalten sich gleich.

## Dimensions considered

| Dimension        | Applies | Note                                                             |
| ---------------- | ------- | ---------------------------------------------------------------- |
| Runtime modes    | yes     | Nur PINS                                                         |
| Polling          | no      | Kein neuer Poller                                                |
| Mobile           | yes     | Bühne über `useStageWindow`, Leiste mit eigener Scrollfläche     |
| i18n             | yes     | Neue Texte zuerst nur in `en.json`                               |
| Equipment safety | yes     | Fortlaufende Testbilder enden vor Autofokus, TPPA und Planstart  |
| Error paths      | no      | Unverändert                                                      |
| Native           | no      | Keine Capacitor-API                                              |
| Persistence      | no      | Auf-/Zuklappen gilt nur für die Sitzung                          |
| Tests            | yes     | Navigation des Modus (`simpleMode.test.js`), Browser-Test `/start` |

## Open questions

- Soll die Polausrichtung später ebenfalls auf die Bühne?
