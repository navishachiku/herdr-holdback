# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#インストール">インストール</a> · <a href="#制限事項">制限事項</a>
</p>

> Herdr でマルチエージェント開発中、入力の途中で別の agent に GANK された経験、ありませんか？

Herdr で PM agent と数体の worker を動かしているとします。PM へのプロンプトを書いている途中で、worker の報告が同じ入力欄に打ち込まれる。Enter を一回押しただけで、両方が一つの支離滅裂なリクエストとして送信されてしまいます。

**使用前**

![Holdback なし：worker のメッセージが、書きかけの PM 向けプロンプトの中に打ち込まれ、両方が一つの支離滅裂なリクエストとして送信される](./media/demo-before.gif)

Holdback なら、順番を待たせられます。見ている pane 宛てのメッセージはその上のバーに並び、あなたが書き終えてから届きます。

**使用後**

![Holdback あり：worker のメッセージは PM pane の上のバーで待機し、その間にあなたは自分のプロンプトを書き終えて送信できる。そのあとバーをクリックすると、独立したメッセージとして届く](./media/demo.gif)

- **入力欄はあなたのもの** — あなたが入力している間は何も打ち込まれません。入力欄が空になるまで配信は待ちます。
- **誰が待っているか一目で** — バーに、待機中のメッセージ数・送信者・冒頭の数語が表示されます。
- **好きなタイミングで受け取る** — バーをクリックするかキーを押すと一覧が開き、メッセージは届いた順に入ります。
- **署名つきメッセージ** — メッセージの先頭に `名前 💬 ` を付けると、バーにどの agent からのものかが表示されます。
- **そのまま作業を続けてもOK** — 別の pane に切り替えれば、キューは順番どおりに配信されます。
- **ほかの pane には影響なし** — 見ていない pane 宛てのメッセージは、すぐに配信されます。

## インストール

Herdr 0.9.3 以降と Node 18 以降が必要です。

```sh
herdr plugin install navishachiku/herdr-holdback
```

`~/.config/herdr/config.toml` にキーを割り当て、`prefix+shift+r` でリロードします：

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

## 制限事項

- 配信に失敗すると送信を中断し、残りはキューに残ります。メッセージが失われることはありません。
- フォーカスが Herdr 全体から外れた場合（別のアプリに切り替えた場合）、フォーカスが別の pane に移るまで何も配信されません。

<details>
<summary>詳細：メッセージの送信、内部の仕組み、設定、テスト</summary>

### メッセージを送る

あなたが見ている間、メッセージをキューに入れたいものはすべて `src/send.mjs` を通します：

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

` 💬 ` より前のテキストが、通知の送信者として使われます。明示したい場合は `--from` を渡します。出力は JSON 一行で、保留されたときは `{"ok":true,"queued":true,"count":2}`、すぐ配信されたときは `"queued":false` です。agent がいる pane 宛ては `herdr agent prompt`、通常のターミナル宛ては `herdr pane run` 経由で入ります。

このリポジトリが提供するのはキューとエントリポイントだけです。agent に `herdr agent prompt` の代わりにこれを呼ばせるのは、あなた自身の送信ガードの役目です。

### 仕組み

| 構成要素 | 役割 |
| --- | --- |
| `src/daemon.mjs` | 常駐するキュー。キューに入れるか即配信するかを判断し、フォーカスが離れたら吐き出し、pane の上のバーを維持します。リクエストは一度に一つずつ処理します。 |
| `src/on-focus.mjs` | `pane.focused` フック。Herdr のイベントはどの pane から離れたかを伝えないため、daemon が前回のフォーカスを自分で覚え、起動時に `herdr pane list` で初期化します。 |
| `src/open.mjs`, `src/list.mjs` | キーのアクションとポップアップ一覧。 |
| `src/send.mjs` | 送信側のエントリポイント。 |

最も古いメッセージが 5 分待っていて入力欄が空のとき、キュー全体が順番に配信されます。daemon は `check_interval_seconds` ごとにこれを確認します（「設定」を参照）。

キューはファイルに保存されるので、daemon を再起動しても続きから再開します。状態は `~/.local/state/herdr/plugins/herdr-holdback/`（`queue.json`）にあります。

### 設定

初回起動時に、プラグインの設定ディレクトリ（`herdr plugin config-dir herdr-holdback`）へ `config.toml` が書き出されます：

```toml
check_interval_seconds = 30
```

見ている pane に 5 分待っているメッセージがないかを、daemon が確認する間隔です。デフォルトは 30 秒。変更を反映するには daemon を再起動してください。5 分の待機時間そのものは設定できません。

### テスト

```sh
npm test
```

本物の daemon とエントリポイントを、偽の `herdr` バイナリに対して実行します。ポップアップのテストには擬似端末用の `python3` が必要です。

</details>

## ライセンス

MIT
