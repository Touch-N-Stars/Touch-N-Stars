# i18n glossary

One term per concept and language. When a string mentions one of these concepts, use the
term from this table — in labels, help texts and error messages alike — so that a help text
refers to a setting with the same word the setting carries on screen.

Keep astronomy terms in English only where the column says so. Extend the table when a new
recurring term comes up, and change all existing strings in the same commit when a term is
replaced.

## Side of pier

The side of the pier or tripod the telescope is on (ASCOM `SideOfPier`). Not the position of
the tube, and not the pier itself.

| Locale | Term                     | Label "Use side of pier"       |
| ------ | ------------------------ | ------------------------------ |
| en     | side of pier / pier side | Use side of pier               |
| de     | Pierseite                | Pierseite verwenden            |
| fr     | côté du pilier           | Utiliser le côté du pilier     |
| es     | lado del pilar           | Usar lado del pilar            |
| it     | lato del pilastro        | Usa lato del pilastro          |
| pt     | lado do pilar            | Usar lado do pilar             |
| ca     | costat del pilar         | Usa el costat del pilar        |
| nl     | pierzijde                | Pierzijde gebruiken            |
| pl     | strona kolumny           | Użyj strony kolumny            |
| cz     | strana sloupu            | Použít stranu sloupu           |
| uk     | сторона колони           | Використовувати сторону колони |
| cn     | 立柱侧                   | 使用立柱侧                     |
| ja     | ピア側                   | ピア側を使用                   |
| ko     | 피어 방향                | 피어 방향 사용                 |

Pitfalls seen in the past: Spanish "lado del meridiano" (wrong concept), and the CJK guider
strings that used "tube position" (鏡筒配置 / 경통 위치).

## Settle

Waiting until something has come to rest. German distinguishes two cases; all other locales
use one term.

| Locale | Guiding (star after a dither)          | Mechanics (mount, focuser, flip after a move) |
| ------ | -------------------------------------- | --------------------------------------------- |
| en     | settle / settling                      | settle time                                   |
| de     | Einpendeln, pendelt ein, Einpendelzeit | Beruhigungszeit                               |
| fr     | stabilisation                          | temps de stabilisation                        |
| es     | estabilización, se estabiliza          | tiempo de estabilización                      |
| it     | assestamento, si assesta               | tempo di assestamento                         |
| pt     | estabilização, a estabilizar           | tempo de estabilização                        |
| ca     | estabilització, s'estabilitza          | temps d'estabilització                        |
| nl     | stabiliseren                           | stabilisatietijd                              |
| pl     | stabilizacja                           | czas stabilizacji                             |
| cz     | ustálení, ustaluje se                  | doba ustálení                                 |
| uk     | стабілізація                           | час стабілізації                              |
| cn     | 稳定                                   | 稳定时间                                      |
| ja     | 安定化, 安定                           | 安定時間                                      |
| ko     | 안정화                                 | 안정화 시간                                   |

Labels with a unit carry it at the end: "(s)", "(px)" — never "Tempo/i" or "Einschwingzeit(en)".
