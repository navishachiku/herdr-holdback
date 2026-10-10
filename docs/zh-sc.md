# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#安装">安装</a> · <a href="#限制">限制</a>
</p>

> 在 Herdr 里跑多 agent 协作时，你是不是也有过打字打到一半被其他 agent GANK 的经历？

你在 Herdr 里同时跑着一个 PM agent 和几个 worker。你正对 PM 打到一半，某个 worker 回报的消息直接打进同一个输入框。按一下 Enter，两段内容就合成一条乱掉的请求发了出去。

**使用前**

![没有 Holdback：worker 的消息被打进你写到一半的 PM prompt，两段内容合成一条乱掉的请求发出](./media/demo-before.gif)

Holdback 让它们排队等候。要发给你正在看的 pane 的消息，会在它上方的计数条上排队，等你忙完再送进去。

**使用后**

![有 Holdback：worker 的消息在 PM pane 上方的计数条里等候，你写完并发出自己的 prompt 后，点一下计数条，它就作为独立一条消息送达](./media/demo.gif)

- **输入框始终是你的** — 你在打字时不会有任何东西被打进去，要等输入框清空才会送达。
- **看得到谁在等** — 计数条会显示排队的消息数量、发件人，以及消息的开头几个字。
- **由你决定何时收** — 点一下计数条或按快捷键就能看列表；消息会按到达顺序送进去。
- **消息带署名** — 消息开头写上 `名称 💬 `，计数条就会显示这条消息来自哪个 agent。
- **或者直接离开** — 切到别的 pane，队列就会依序送达。
- **不影响其他 pane** — 发给你没在看的 pane 的消息，会直接送达。

## 安装

需要 Herdr 0.9.3 或更新版本，以及 Node 18 或更新版本。

```sh
herdr plugin install navishachiku/herdr-holdback
```

在 `~/.config/herdr/config.toml` 绑定一个按键，然后用 `prefix+shift+r` 重新加载：

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

## 限制

- 送达失败会中止这一轮发送，并让剩下的消息继续留在队列里；不会丢掉任何消息。
- 如果焦点完全离开 Herdr（你切到别的应用程序），在焦点移到另一个 pane 之前，不会送达任何消息。

<details>
<summary>进阶：发送消息、运作方式、设置、测试</summary>

### 发送消息

任何想在你正在看的时候让消息排队的东西，都要经过 `src/send.mjs`：

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

` 💬 ` 之前的文字会被当成通知上的发件人；要明确指定的话，可以用 `--from`。输出是一行 JSON：被拦住排队时是 `{"ok":true,"queued":true,"count":2}`，直接送达时则是 `"queued":false`。发给有 agent 的 pane，消息会经由 `herdr agent prompt` 送进去；发给普通终端，则经由 `herdr pane run`。

这个仓库只提供队列和入口。要让你的 agent 改用它而不是 `herdr agent prompt`，要靠你自己的发送守卫机制。

### 运作方式

| 组件 | 职责 |
| --- | --- |
| `src/daemon.mjs` | 常驻的队列。决定要排队还是直接送达，焦点离开时送出，并维持 pane 上方的计数条。一次只处理一个请求。 |
| `src/on-focus.mjs` | `pane.focused` hook。Herdr 的事件不会说离开的是哪个 pane，所以 daemon 自己记住前一个焦点，并在启动时用 `herdr pane list` 补上初始值。 |
| `src/open.mjs`, `src/list.mjs` | 快捷键的动作与弹出的列表。 |
| `src/send.mjs` | 发件方的入口。 |

当最旧的一条消息已等待 5 分钟，且输入框是空的，整个队列就会依序送达；daemon 每隔 `check_interval_seconds` 检查一次（见“设置”）。

队列存在文件里，所以 daemon 重新启动后能从中断处继续。状态放在 `~/.local/state/herdr/plugins/herdr-holdback/`（`queue.json`）。

### 设置

首次运行会把 `config.toml` 写到插件配置目录（`herdr plugin config-dir herdr-holdback`）：

```toml
check_interval_seconds = 30
```

这是 daemon 检查你正在看的 pane 是否有消息已等待 5 分钟的频率。默认为 30 秒；修改后要重新启动 daemon 才会生效。5 分钟的等待时间本身不可设置。

### 测试

```sh
npm test
```

测试会用假的 `herdr` 可执行文件来跑真正的 daemon 和入口。弹出列表的测试需要 `python3` 来提供伪终端。

</details>

## 许可证

MIT
