# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#설치">설치</a> · <a href="#제한-사항">제한 사항</a>
</p>

> Herdr에서 멀티 에이전트로 일하다가, 타이핑 도중에 다른 agent한테 갱(GANK) 당한 적 있나요?

Herdr에서 PM agent 하나와 worker 몇 개를 돌리고 있습니다. PM에게 보낼 프롬프트를 쓰다 말고 있는데, worker의 보고가 같은 입력창에 그대로 타이핑돼 들어옵니다. Enter 한 번이면 둘이 한 덩어리로 뒤엉킨 요청이 되어 나갑니다.

**사용 전**

![Holdback 없을 때: worker의 메시지가 쓰던 PM 프롬프트 안에 타이핑되고, 둘이 하나의 뒤엉킨 요청으로 전송된다](./media/demo-before.gif)

Holdback은 순서를 기다리게 합니다. 보고 있는 pane으로 오는 메시지는 그 위의 바에 줄을 서고, 당신이 다 쓴 뒤에 들어갑니다.

**사용 후**

![Holdback 사용 시: worker의 메시지는 PM pane 위의 바에서 기다리고, 그동안 당신은 프롬프트를 마저 쓰고 보냅니다. 이후 바를 클릭하면 별도의 메시지로 전달된다](./media/demo.gif)

- **입력창은 계속 당신 것** — 타이핑하는 동안에는 아무것도 입력되지 않으며, 입력창이 빌 때까지 전달을 기다립니다.
- **누가 기다리는지 한눈에** — 바에 대기 중인 메시지 수, 보낸 쪽, 첫머리 몇 단어가 표시됩니다.
- **원할 때 받기** — 바를 클릭하거나 키를 누르면 목록이 열리고, 메시지는 도착한 순서대로 들어갑니다.
- **서명된 메시지** — 메시지를 `이름 💬 `로 시작하면 바에 어느 agent가 보냈는지 표시됩니다.
- **그냥 넘어가도 OK** — 다른 pane으로 전환하면 대기열이 순서대로 전달됩니다.
- **다른 pane은 그대로** — 보고 있지 않은 pane으로 가는 메시지는 바로 전달됩니다.

## 설치

Herdr 0.9.3 이상과 Node 18 이상이 필요합니다.

```sh
herdr plugin install navishachiku/herdr-holdback
```

`~/.config/herdr/config.toml`에 키를 지정하고 `prefix+shift+r`로 다시 불러옵니다:

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

## 제한 사항

- 전달이 실패하면 비우기를 멈추고 나머지는 대기열에 남습니다. 사라지는 메시지는 없습니다.
- 포커스가 Herdr 밖으로 완전히 나가면(다른 앱으로 전환하면), 포커스가 다른 pane으로 옮겨질 때까지 아무것도 전달되지 않습니다.

<details>
<summary>고급: 메시지 보내기, 내부 동작, 설정, 테스트</summary>

### 메시지 보내기

당신이 보고 있는 동안 메시지를 대기열에 넣으려는 모든 것은 `src/send.mjs`를 거칩니다:

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

` 💬 ` 앞의 텍스트가 알림의 보낸 쪽으로 쓰입니다. 명시하려면 `--from`을 넘기세요. 출력은 JSON 한 줄이며, 보류되면 `{"ok":true,"queued":true,"count":2}`, 즉시 전달되면 `"queued":false`입니다. agent가 있는 pane으로 가는 메시지는 `herdr agent prompt`를, 일반 터미널로 가는 메시지는 `herdr pane run`을 거칩니다.

이 저장소가 제공하는 것은 대기열과 진입점뿐입니다. agent가 `herdr agent prompt` 대신 이것을 호출하게 만드는 일은 각자의 전송 가드가 맡습니다.

### 동작 방식

| 구성 요소 | 역할 |
| --- | --- |
| `src/daemon.mjs` | 상주하는 대기열. 대기열에 넣을지 바로 전달할지 결정하고, 포커스가 떠나면 비우며, pane 위의 바를 유지합니다. 요청은 한 번에 하나씩 처리합니다. |
| `src/on-focus.mjs` | `pane.focused` 훅. Herdr 이벤트는 어느 pane을 떠났는지 알려주지 않으므로, daemon이 이전 포커스를 직접 기억하고 시작할 때 `herdr pane list`로 초기값을 채웁니다. |
| `src/open.mjs`, `src/list.mjs` | 키의 동작과 팝업 목록. |
| `src/send.mjs` | 보내는 쪽의 진입점. |

가장 오래된 메시지가 5분 동안 기다렸고 입력창이 비어 있으면, 대기열 전체가 순서대로 전달됩니다. daemon은 `check_interval_seconds`마다 이를 확인합니다(‘설정’ 참고).

대기열은 파일에 저장되므로, 다시 시작한 daemon은 멈췄던 곳에서 이어갑니다. 상태는 `~/.local/state/herdr/plugins/herdr-holdback/`(`queue.json`)에 있습니다.

### 설정

처음 실행하면 플러그인 설정 디렉터리(`herdr plugin config-dir herdr-holdback`)에 `config.toml`이 만들어집니다:

```toml
check_interval_seconds = 30
```

보고 있는 pane에 5분 동안 기다린 메시지가 있는지 daemon이 확인하는 주기입니다. 기본값은 30초이며, 변경을 적용하려면 daemon을 다시 시작하세요. 5분의 대기 시간 자체는 설정할 수 없습니다.

### 테스트

```sh
npm test
```

진짜 daemon과 진입점을 가짜 `herdr` 바이너리에 대해 실행합니다. 팝업 테스트에는 의사 터미널용 `python3`이 필요합니다.

</details>

## 라이선스

MIT
