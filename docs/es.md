# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#instalación">Instalación</a> · <a href="#limitaciones">Limitaciones</a>
</p>

> ¿Alguna vez otro agente te ha gankeado mientras escribías en un flujo de trabajo multiagente de Herdr?

Tienes un agente PM y varios workers corriendo en Herdr. Estás a mitad de un prompt para el PM cuando un worker reporta y su mensaje se escribe en la misma caja. Un solo Enter, y los dos salen juntos como una sola petición ilegible.

**Antes**

![Sin Holdback: el mensaje de un worker se escribe dentro del prompt del PM que estabas redactando, y ambos se envían como una sola petición ilegible](./media/demo-before.gif)

Holdback los hace esperar su turno. Los mensajes para el pane que estás mirando hacen cola en una barra encima de él y entran cuando terminas.

**Después**

![Con Holdback: el mensaje del worker espera en una barra encima del pane del PM mientras terminas y envías tu propio prompt; luego, un clic en la barra lo entrega como un mensaje independiente](./media/demo.gif)

- **Tu caja de entrada sigue siendo tuya** — no se escribe nada mientras tú escribes; la entrega espera a que la caja esté vacía.
- **Ve quién está esperando** — la barra muestra cuántos mensajes hay en cola, quién los envió y sus primeras palabras.
- **Recíbelos cuando quieras** — haz clic en la barra o pulsa la tecla para ver la lista; los mensajes entran en el orden en que llegaron.
- **Mensajes firmados** — empieza un mensaje con `nombre 💬 ` y la barra muestra de qué agente viene.
- **O simplemente sigue con lo tuyo** — cambia a otro pane y la cola se entrega en orden.
- **Los demás panes, intactos** — un mensaje a un pane que no estás mirando se entrega al instante.

## Instalación

Requiere Herdr 0.9.3 o posterior y Node 18 o posterior.

```sh
herdr plugin install navishachiku/herdr-holdback
```

Asigna una tecla en `~/.config/herdr/config.toml` y recarga con `prefix+shift+r`:

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

## Limitaciones

- Si una entrega falla, se detiene el vaciado y el resto sigue en cola; no se pierde nada.
- Si el foco sale de Herdr por completo (cambias a otra aplicación), no se entrega nada hasta que el foco pase a un pane distinto.

<details>
<summary>Avanzado: envío de mensajes, funcionamiento interno, configuración y pruebas</summary>

### Enviar un mensaje

Todo lo que quiera que su mensaje quede en cola mientras tú miras pasa por `src/send.mjs`:

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

El texto anterior a ` 💬 ` se toma como remitente de la notificación; usa `--from` para indicarlo de forma explícita. La salida es una línea JSON: `{"ok":true,"queued":true,"count":2}` si el mensaje se retuvo y `"queued":false` si se entregó de inmediato. Los mensajes a un pane que aloja un agente entran por `herdr agent prompt`; a una terminal normal, por `herdr pane run`.

Este repositorio solo aporta la cola y el punto de entrada. Que tus agentes lo llamen en lugar de `herdr agent prompt` depende de tu propio guardián de envío.

### Cómo funciona

| Pieza | Función |
| --- | --- |
| `src/daemon.mjs` | Cola persistente en segundo plano. Decide si encolar o entregar, vacía la cola cuando el foco sale, mantiene la barra sobre el pane. Una petición a la vez. |
| `src/on-focus.mjs` | Hook de `pane.focused`. El evento de Herdr no indica qué pane se dejó, así que el daemon recuerda el foco anterior por sí mismo y lo inicializa con `herdr pane list` al arrancar. |
| `src/open.mjs`, `src/list.mjs` | La acción de la tecla y la lista emergente. |
| `src/send.mjs` | Punto de entrada para quienes envían. |

Cuando el mensaje más antiguo lleva 5 minutos esperando y la caja de entrada está vacía, toda la cola se entrega en orden; el daemon lo comprueba cada `check_interval_seconds` (véase Configuración).

La cola vive en un archivo, así que un daemon reiniciado continúa donde se quedó. El estado está en `~/.local/state/herdr/plugins/herdr-holdback/` (`queue.json`).

### Configuración

La primera ejecución escribe `config.toml` en el directorio de configuración del plugin (`herdr plugin config-dir herdr-holdback`):

```toml
check_interval_seconds = 30
```

Con qué frecuencia comprueba el daemon si el pane que estás mirando tiene mensajes que llevan 5 minutos esperando. Por defecto, 30 segundos; reinicia el daemon para aplicar un cambio. La espera de 5 minutos en sí no es configurable.

### Pruebas

```sh
npm test
```

Ejecuta el daemon y los puntos de entrada reales contra un binario `herdr` falso. Las pruebas de la lista emergente necesitan `python3` para un pseudoterminal.

</details>

## Licencia

MIT
