# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](./README.md) | [简体中文](./docs/zh-sc.md) | [繁體中文](./docs/zh-tc.md) | [Español](./docs/es.md) | [Português](./docs/pt.md) | [Русский](./docs/ru.md) | [日本語](./docs/jp.md) | [Français](./docs/fr.md) | [Deutsch](./docs/de.md) | [Tiếng Việt](./docs/vi.md) | [한국어](./docs/ko.md) | [ไทย](./docs/th.md) | [Italiano](./docs/it.md)

<p align="center">
  <a href="#install">install</a> · <a href="#limits">limits</a>
</p>

> Ever been GANKED by another agent while typing in a Herdr multi-agent workflow?

You run a PM agent and a few workers in Herdr. You're halfway through a prompt to the PM when a worker reports back, typed into the same box. One Enter, and both go out as a single garbled request.

**Before**

![Without Holdback: a worker's message is typed into the PM prompt you were halfway through writing, and both are sent as one garbled request](docs/media/demo-before.gif)

Holdback makes them wait their turn. Messages for the pane you're watching line up in a bar above it, and come in when you're done.

**After**

![With Holdback: the worker's message waits in a bar above the PM pane while you finish and send your own prompt, then a click on the bar delivers it as its own message](docs/media/demo.gif)

- **Your input box stays yours** — nothing is typed while you are typing; delivery waits until the box is empty.
- **See who's waiting** — the bar shows how many messages are queued, who sent them, and their first words.
- **Take them on your terms** — click the bar or press the key to see the list; messages go in, in the order they arrived.
- **Signed messages** — start a message with `name 💬 ` and the bar shows which agent it came from.
- **Or just move on** — switch to another pane and the queue is delivered in order.
- **Other panes untouched** — a message to a pane you are not watching is delivered straight away.

## Install

Requires Herdr 0.9.3 or newer and Node 18 or newer.

```sh
herdr plugin install navishachiku/herdr-holdback
```

Bind a key in `~/.config/herdr/config.toml` and reload with `prefix+shift+r`:

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

## Limits

- A failed delivery stops the flush and keeps the rest queued; nothing is
  dropped.
- If focus leaves Herdr entirely (you switch to another app), nothing is
  delivered until focus moves to a different pane.

<details>
<summary>Advanced: sending messages, internals, configuration, tests</summary>

### Sending a message

Anything that wants its message queued while you are watching goes through
`src/send.mjs`:

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

The text before ` 💬 ` is taken as the sender for the notification; pass
`--from` to name it explicitly. The output is one JSON line:
`{"ok":true,"queued":true,"count":2}` when held back, `"queued":false` when it
was delivered at once. Messages to a pane that hosts an agent go in through
`herdr agent prompt`, to a plain terminal through `herdr pane run`.

This repo only provides the queue and the entry point. Making your agents call
it instead of `herdr agent prompt` is up to your own send guard.

### How it works

| Piece | Role |
| --- | --- |
| `src/daemon.mjs` | Long-running queue. Decides queue or deliver, flushes on focus leave, keeps the bar above the pane. One request at a time. |
| `src/on-focus.mjs` | `pane.focused` hook. Herdr's event does not say which pane was left, so the daemon remembers the previous focus itself and seeds it from `herdr pane list` on start. |
| `src/open.mjs`, `src/list.mjs` | The key's action and the popup list. |
| `src/send.mjs` | Entry point for senders. |

When the oldest message has waited 5 minutes and the input box is empty, the whole queue is delivered in order; the daemon checks this every `check_interval_seconds` (see Configuration).

The queue lives in a file, so a restarted daemon picks up where it stopped. State is in `~/.local/state/herdr/plugins/herdr-holdback/` (`queue.json`).

### Configuration

The first run writes `config.toml` to the plugin config directory
(`herdr plugin config-dir herdr-holdback`):

```toml
check_interval_seconds = 30
```

How often the daemon checks whether the pane you are watching has messages
that have waited 5 minutes. Default 30 seconds; restart the daemon to apply a
change. The 5-minute wait itself is not configurable.

### Tests

```sh
npm test
```

Runs the real daemon and entry points against a fake `herdr` binary. The popup
tests need `python3` for a pseudo-terminal.

</details>

## License

MIT
