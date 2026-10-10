# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#installation">Installation</a> · <a href="#einschränkungen">Einschränkungen</a>
</p>

> Wurdest du schon mal von einem anderen Agenten gegankt, während du in einem Herdr-Multi-Agent-Workflow getippt hast?

Du lässt in Herdr einen PM-Agenten und ein paar Worker laufen. Du bist mitten in einem Prompt an den PM, als ein Worker sich meldet – getippt in dieselbe Eingabebox. Ein Enter, und beides geht als ein einziger wirrer Auftrag raus.

**Vorher**

![Ohne Holdback: Die Nachricht eines Workers wird in den PM-Prompt getippt, den du gerade schreibst, und beides wird als ein einziger wirrer Auftrag abgeschickt](./media/demo-before.gif)

Holdback lässt sie warten, bis sie dran sind. Nachrichten für das Pane, das du gerade ansiehst, reihen sich in einer Leiste darüber ein und kommen an, wenn du fertig bist.

**Nachher**

![Mit Holdback: Die Nachricht des Workers wartet in einer Leiste über dem PM-Pane, während du deinen eigenen Prompt fertig schreibst und abschickst; danach liefert ein Klick auf die Leiste sie als eigene Nachricht aus](./media/demo.gif)

- **Deine Eingabebox gehört dir** — während du tippst, wird nichts hineingeschrieben; die Zustellung wartet, bis die Box leer ist.
- **Sieh, wer wartet** — die Leiste zeigt, wie viele Nachrichten anstehen, von wem sie sind und ihre ersten Worte.
- **Hol sie ab, wann du willst** — Klick auf die Leiste oder die Taste drücken zeigt die Liste; die Nachrichten gehen in der Reihenfolge ihres Eintreffens hinein.
- **Signierte Nachrichten** — beginne eine Nachricht mit `Name 💬 `, und die Leiste zeigt, von welchem Agenten sie kommt.
- **Oder mach einfach weiter** — wechsle in ein anderes Pane, und die Warteschlange wird der Reihe nach zugestellt.
- **Andere Panes bleiben unberührt** — eine Nachricht an ein Pane, das du nicht ansiehst, wird sofort zugestellt.

## Installation

Erfordert Herdr 0.9.3 oder neuer und Node 18 oder neuer.

```sh
herdr plugin install navishachiku/herdr-holdback
```

Lege in `~/.config/herdr/config.toml` eine Taste fest und lade mit `prefix+shift+r` neu:

```toml
[[keys.command]]
key = "alt+i"
type = "plugin_action"
command = "herdr-holdback.open"
description = "open the holdback list"

# Notifications are off by default; the queue notice needs this.
[ui.toast]
delivery = "herdr"
```

## Einschränkungen

- Schlägt eine Zustellung fehl, bricht das Abarbeiten ab und der Rest bleibt in der Warteschlange; nichts geht verloren.
- Verlässt der Fokus Herdr ganz (du wechselst in eine andere App), wird nichts zugestellt, bis der Fokus zu einem anderen Pane wechselt.

<details>
<summary>Erweitert: Nachrichten senden, Interna, Konfiguration, Tests</summary>

### Eine Nachricht senden

Alles, was seine Nachricht einreihen lassen will, solange du hinsiehst, läuft über `src/send.mjs`:

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

Der Text vor ` 💬 ` wird als Absender der Benachrichtigung verwendet; mit `--from` gibst du ihn ausdrücklich an. Die Ausgabe ist eine JSON-Zeile: `{"ok":true,"queued":true,"count":2}` wenn die Nachricht zurückgehalten wurde, `"queued":false` wenn sie sofort zugestellt wurde. Nachrichten an ein Pane mit einem Agenten gehen über `herdr agent prompt`, an ein normales Terminal über `herdr pane run`.

Dieses Repository liefert nur die Warteschlange und den Einstiegspunkt. Dafür zu sorgen, dass deine Agenten es statt `herdr agent prompt` aufrufen, liegt bei deinem eigenen Sende-Guard.

### So funktioniert es

| Baustein | Aufgabe |
| --- | --- |
| `src/daemon.mjs` | Dauerhaft laufende Warteschlange. Entscheidet zwischen Einreihen und Zustellen, leert die Schlange beim Fokuswechsel und hält die Leiste über dem Pane. Eine Anfrage nach der anderen. |
| `src/on-focus.mjs` | `pane.focused`-Hook. Das Herdr-Ereignis nennt nicht, welches Pane verlassen wurde; der Daemon merkt sich den vorherigen Fokus daher selbst und initialisiert ihn beim Start mit `herdr pane list`. |
| `src/open.mjs`, `src/list.mjs` | Die Aktion der Taste und die Popup-Liste. |
| `src/send.mjs` | Einstiegspunkt für Absender. |

Wartet die älteste Nachricht seit 5 Minuten und die Eingabebox ist leer, wird die ganze Warteschlange der Reihe nach zugestellt; der Daemon prüft das alle `check_interval_seconds` (siehe Konfiguration).

Die Warteschlange liegt in einer Datei, daher macht ein neu gestarteter Daemon dort weiter, wo er aufgehört hat. Der Zustand liegt in `~/.local/state/herdr/plugins/herdr-holdback/` (`queue.json`).

### Konfiguration

Beim ersten Start wird `config.toml` in das Konfigurationsverzeichnis des Plugins geschrieben (`herdr plugin config-dir herdr-holdback`):

```toml
check_interval_seconds = 30
```

Wie oft der Daemon prüft, ob das Pane, das du ansiehst, Nachrichten hat, die seit 5 Minuten warten. Standard: 30 Sekunden; starte den Daemon neu, damit eine Änderung greift. Die 5 Minuten Wartezeit selbst sind nicht konfigurierbar.

### Tests

```sh
npm test
```

Startet den echten Daemon und die echten Einstiegspunkte gegen eine Attrappe des `herdr`-Binaries. Die Popup-Tests brauchen `python3` für ein Pseudo-Terminal.

</details>

## Lizenz

MIT
