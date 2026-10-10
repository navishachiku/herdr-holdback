# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#安裝">安裝</a> · <a href="#限制">限制</a>
</p>

> 在 Herdr 跑多 agent 協作時，你是否曾在打字打到一半時被其他 agent GANK 過？

你在 Herdr 裡同時跑著一個 PM agent 和幾個 worker。你正對 PM 打到一半，某個 worker 回報的訊息直接打進同一個輸入框。按下一次 Enter，兩段內容就合成一則亂掉的請求送了出去。

**使用前**

![沒有 Holdback：worker 的訊息被打進你寫到一半的 PM prompt，兩段內容合成一則亂掉的請求送出](./media/demo-before.gif)

Holdback 讓它們排隊等候。要送給你正在看的 pane 的訊息，會在它上方的計數條上排隊，等你忙完再送進去。

**使用後**

![有 Holdback：worker 的訊息在 PM pane 上方的計數條中等候，你寫完並送出自己的 prompt 後，點一下計數條，它就以獨立一則訊息送達](./media/demo.gif)

- **輸入框始終是你的** — 你在打字時不會有任何東西被打進去，要等輸入框清空才會送達。
- **看得到誰在等** — 計數條會顯示排隊的訊息數量、寄件者，以及訊息的開頭幾個字。
- **由你決定何時收** — 點一下計數條或按快捷鍵就能看清單；訊息會依抵達順序送進去。
- **訊息附署名** — 訊息開頭寫上 `名稱 💬 `，計數條就會顯示這則訊息來自哪個 agent。
- **或直接離開** — 切到別的 pane，佇列就會依序送達。
- **不影響其他 pane** — 送給你沒在看的 pane 的訊息，會直接送達。

## 安裝

需要 Herdr 0.9.3 或更新版本，以及 Node 18 或更新版本。

```sh
herdr plugin install navishachiku/herdr-holdback
```

在 `~/.config/herdr/config.toml` 綁一個按鍵，然後以 `prefix+shift+r` 重新載入：

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

- 送達失敗會中止這一輪送出，並讓剩下的訊息繼續留在佇列裡；不會丟掉任何訊息。
- 如果焦點完全離開 Herdr（你切到別的應用程式），在焦點移到另一個 pane 之前，不會送達任何訊息。

<details>
<summary>進階：傳送訊息、運作方式、設定、測試</summary>

### 傳送訊息

任何想在你正在看的時候讓訊息排隊的東西，都要經過 `src/send.mjs`：

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

` 💬 ` 之前的文字會被當成通知上的寄件者；要明確指定的話，可以用 `--from`。輸出是一行 JSON：被攔住排隊時是 `{"ok":true,"queued":true,"count":2}`，直接送達時則是 `"queued":false`。送給有 agent 的 pane，訊息會經由 `herdr agent prompt` 送進去；送給一般終端機，則經由 `herdr pane run`。

這個 repo 只提供佇列和入口。要讓你的 agent 改用它而不是 `herdr agent prompt`，要靠你自己的送訊守門機制。

### 運作方式

| 元件 | 職責 |
| --- | --- |
| `src/daemon.mjs` | 常駐的佇列。決定要排隊還是直接送達，焦點離開時送出，並維持 pane 上方的計數條。一次只處理一個請求。 |
| `src/on-focus.mjs` | `pane.focused` hook。Herdr 的事件不會說離開的是哪個 pane，所以 daemon 自己記住前一個焦點，並在啟動時用 `herdr pane list` 補上初始值。 |
| `src/open.mjs`、`src/list.mjs` | 快捷鍵的動作與彈出的清單。 |
| `src/send.mjs` | 寄件者的入口。 |

當最舊的一則訊息已等待 5 分鐘，且輸入框是空的，整個佇列就會依序送達；daemon 每隔 `check_interval_seconds` 檢查一次（見「設定」）。

佇列存在檔案裡，所以 daemon 重新啟動後能從中斷處繼續。狀態放在 `~/.local/state/herdr/plugins/herdr-holdback/`（`queue.json`）。

### 設定

首次執行會把 `config.toml` 寫到外掛設定目錄（`herdr plugin config-dir herdr-holdback`）：

```toml
check_interval_seconds = 30
```

這是 daemon 檢查你正在看的 pane 是否有訊息已等待 5 分鐘的頻率。預設為 30 秒；修改後要重新啟動 daemon 才會生效。5 分鐘的等待時間本身不可設定。

### 測試

```sh
npm test
```

測試會用假的 `herdr` 執行檔來跑真正的 daemon 和入口。彈出清單的測試需要 `python3` 來提供虛擬終端機（pseudo-terminal）。

</details>

## 授權

MIT
