# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#instalação">Instalação</a> · <a href="#limitações">Limitações</a>
</p>

> Já foi gankeado por outro agente enquanto digitava num fluxo multiagente do Herdr?

Você roda um agente PM e alguns workers no Herdr. Está no meio de um prompt para o PM quando um worker reporta e a mensagem cai na mesma caixa. Um Enter, e os dois saem juntos como um único pedido embaralhado.

**Antes**

![Sem o Holdback: a mensagem de um worker é digitada dentro do prompt do PM que você estava escrevendo, e os dois são enviados como um único pedido embaralhado](./media/demo-before.gif)

O Holdback faz cada um esperar a sua vez. As mensagens para o pane que você está olhando entram na fila em uma barra acima dele e chegam quando você terminar.

**Depois**

![Com o Holdback: a mensagem do worker espera numa barra acima do pane do PM enquanto você termina e envia o seu próprio prompt; depois, um clique na barra a entrega como uma mensagem separada](./media/demo.gif)

- **Sua caixa de entrada continua sua** — nada é digitado enquanto você digita; a entrega espera a caixa ficar vazia.
- **Veja quem está esperando** — a barra mostra quantas mensagens estão na fila, quem as enviou e as primeiras palavras de cada uma.
- **Receba quando quiser** — clique na barra ou aperte a tecla para ver a lista; as mensagens entram na ordem em que chegaram.
- **Mensagens assinadas** — comece a mensagem com `nome 💬 ` e a barra mostra de qual agente ela veio.
- **Ou simplesmente siga em frente** — troque para outro pane e a fila é entregue em ordem.
- **Outros panes intocados** — uma mensagem para um pane que você não está olhando é entregue na hora.

## Instalação

Requer Herdr 0.9.3 ou mais recente e Node 18 ou mais recente.

```sh
herdr plugin install navishachiku/herdr-holdback
```

Atribua uma tecla em `~/.config/herdr/config.toml` e recarregue com `prefix+shift+r`:

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

## Limitações

- Se uma entrega falhar, o envio é interrompido e o restante continua na fila; nada é descartado.
- Se o foco sair do Herdr por completo (você troca para outro aplicativo), nada é entregue até o foco ir para outro pane.

<details>
<summary>Avançado: envio de mensagens, funcionamento interno, configuração e testes</summary>

### Enviando uma mensagem

Tudo que precisa ter a mensagem enfileirada enquanto você está olhando passa por `src/send.mjs`:

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

O texto antes de ` 💬 ` é usado como remetente na notificação; use `--from` para informá-lo explicitamente. A saída é uma linha JSON: `{"ok":true,"queued":true,"count":2}` quando a mensagem foi retida e `"queued":false` quando foi entregue na hora. Mensagens para um pane que hospeda um agente entram por `herdr agent prompt`; para um terminal comum, por `herdr pane run`.

Este repositório fornece apenas a fila e o ponto de entrada. Fazer seus agentes chamarem isso em vez de `herdr agent prompt` fica por conta do seu próprio guarda de envio.

### Como funciona

| Peça | Função |
| --- | --- |
| `src/daemon.mjs` | Fila persistente em segundo plano. Decide entre enfileirar ou entregar, descarrega quando o foco sai e mantém a barra acima do pane. Uma requisição por vez. |
| `src/on-focus.mjs` | Hook de `pane.focused`. O evento do Herdr não diz de qual pane o foco saiu, então o daemon guarda o foco anterior por conta própria e o inicializa com `herdr pane list` ao iniciar. |
| `src/open.mjs`, `src/list.mjs` | A ação da tecla e a lista em popup. |
| `src/send.mjs` | Ponto de entrada para quem envia. |

Quando a mensagem mais antiga espera há 5 minutos e a caixa de entrada está vazia, a fila inteira é entregue em ordem; o daemon verifica isso a cada `check_interval_seconds` (veja Configuração).

A fila fica em um arquivo, então um daemon reiniciado continua de onde parou. O estado fica em `~/.local/state/herdr/plugins/herdr-holdback/` (`queue.json`).

### Configuração

A primeira execução grava o `config.toml` no diretório de configuração do plugin (`herdr plugin config-dir herdr-holdback`):

```toml
check_interval_seconds = 30
```

Com que frequência o daemon verifica se o pane que você está olhando tem mensagens esperando há 5 minutos. O padrão é 30 segundos; reinicie o daemon para aplicar uma mudança. A espera de 5 minutos em si não é configurável.

### Testes

```sh
npm test
```

Executa o daemon e os pontos de entrada reais contra um binário `herdr` falso. Os testes do popup precisam de `python3` para um pseudoterminal.

</details>

## Licença

MIT
