# Atlas: „Heute Nacht gut sichtbar“

Status: implemented, not yet verified on a device
Date: 2026-11-23

## Goal

Im Himmelsatlas (Einfach- und Normalmodus) sieht ein Einsteiger im Himmelsatlas ohne Vorwissen, welche Ziele heute Nacht
gut sichtbar sind, und übernimmt eines mit einem Tipp in den Plan. Der Atlas beantwortet bisher
nur „Wo ist Objekt X?“, nicht „Was soll ich heute fotografieren?“.

## Scope

- Runtime modes: beide (rein clientseitig: Katalog, Standort, `astronomy.js`)
- Surface: Himmelsatlas in beiden Modi, Header (`CelestiaAtlasView.vue`); Ranking-Logik aus dem
  Plugin ObservationPlaner in ein Util ausgelagert
- Backends touched: none

## Non-goals

- Das Plugin ObservationPlaner bleibt unverändert: gleiche UI, gleiche Filter, gleiche Reihenfolge,
  gleiches Beobachtungsfenster (18:00–06:00).
- Keine neuen Einstellungen, keine Bildfeld-Passung, kein erweiterter Katalog.
- Die Atlas-Suche bleibt wie sie ist.
- Der Tipp auf einen Vorschlag bewegt keine Hardware und ändert den Plan nicht.

## Acceptance criteria

1. Given bekannter Standort (Einfach- und Normalmodus), when der Atlas geöffnet wird, then steht oben
   „Heute Nacht gut sichtbar“ mit höchstens 8 Zielen, nach Score sortiert, mit Name,
   Katalognummer, Typ und maximaler Höhe.
2. Given ein Vorschlag, when er angetippt wird, then fliegt der Atlas zum Ziel und wählt es aus
   (wie ein Suchtreffer); das Zielpanel zeigt „In den Plan“ als Hauptknopf. Der Tipp selbst
   schwenkt die Montierung nicht und ändert den Plan nicht.
3. Given ein so gewähltes Ziel, when „In den Plan“ gedrückt wird, then bekommt es dieselben
   Schritte wie bei einem Suchtreffer (Zentrieren, Guiding, Autofokus nach Filterwechsel,
   Meridian-Flip über `applySimpleTargetSteps`).
4. Given kein Standort (weder Profil noch NINA), then zeigt die Liste einen Hinweis statt leerer
   Karten oder falscher Werte.
5. Given das Plugin ObservationPlaner nach dem Auslagern, then liefert es für festes Datum und
   Standort dieselben Scores und dieselbe Reihenfolge wie vorher (Unit-Test, Fenster 18:00–06:00).
6. Given Vollmond nahe einem Galaxienziel, then steht dieses hinter einem Sternhaufen gleicher
   Höhe, wie es der Mondabzug heute vorsieht (Unit-Test).
7. Given die Atlas-Liste, then ergibt sich das Beobachtungsfenster aus dem Sonnenstand
   (`getSunAltitudeDeg`): von Sonnenuntergang/Dämmerung bis zur Morgendämmerung der kommenden
   Nacht, nicht fest 18:00–06:00. Unit-Test mit Sommer- und Winterdatum; um 02:00 Uhr nachts zählt
   die laufende Nacht, nicht die nächste. Polarnacht/-tag ohne Dämmerungsende liefert ein
   definiertes Ergebnis, keinen Absturz.
8. Given Telefon (360 px) und Tablet, then kein Überlauf nach rechts, Zeilen mindestens 48 px
   hoch (`min-h-touch`); `npm run test:browser` bleibt grün.

## Dimensions considered

| Dimension | Applies | Note |
| --- | --- | --- |
| Runtime modes | yes | Nur Client-Rechnung, `/v2/api` wird nicht berührt; NINA und PINS identisch |
| Polling | no | Liste rechnet beim Öffnen und bei Standortänderung neu; kein neuer Poller |
| Mobile | yes | Kriterium 8 |
| i18n | yes | Neue Keys nur in `en.json`, die 13 weiteren Sprachen in einer Charge vor dem Commit |
| Equipment safety | no | Tipp wählt nur im Atlas aus; Schwenken erst über die bestehenden Atlas-Knöpfe |
| Error paths | yes | Kriterium 4 (kein Standort), Kriterium 7 (Polartag/-nacht) |
| Native | no | Keine Capacitor-Besonderheiten |
| Persistence | no | Nichts wird gespeichert |
| Tests | yes | Ranking und Nachtfenster als Util mit Unit-Tests (Kriterien 5–7) |

## Open questions

- Nachtfenster: umgesetzt mit nautischer Dämmerung (Sonne unter −12°). Wer lieber astronomisch
  (−18°) will, ändert `NIGHT_SUN_ALT_DEG` in `src/utils/tonightPicks.js`.
- Mindesthöhe: umgesetzt mit 30° (`SIMPLE_MIN_ALT_DEG`), das Plugin behält 20°.
- Noch nicht auf einem Gerät geprüft: Dropdown im Atlas (Header-Platz neben Suche und Einstellungen
  auf 360 px), Auswahl über `viewer.search(<Katalognummer>)`.
