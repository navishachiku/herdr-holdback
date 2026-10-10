# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#installazione">Installazione</a> · <a href="#limiti">Limiti</a>
</p>

> Ti è mai capitato di essere gankato da un altro agente mentre scrivevi in un workflow multi-agente di Herdr?

Fai girare in Herdr un agente PM e alcuni worker. Sei a metà di un prompt per il PM quando un worker risponde e il suo messaggio finisce nella stessa casella. Un solo Invio e i due testi partono insieme come un'unica richiesta illeggibile.

**Prima**

![Senza Holdback: il messaggio di un worker viene scritto dentro il prompt del PM che stavi componendo, e i due testi vengono inviati come un'unica richiesta illeggibile](./media/demo-before.gif)

Holdback li fa aspettare il loro turno. I messaggi destinati al pane che stai guardando si mettono in coda in una barra sopra di esso e arrivano quando hai finito.

**Dopo**

![Con Holdback: il messaggio del worker aspetta in una barra sopra il pane del PM mentre finisci e invii il tuo prompt; poi un clic sulla barra lo consegna come messaggio a sé](./media/demo.gif)

- **La tua casella di input resta tua** — niente viene digitato mentre scrivi; la consegna aspetta che la casella sia vuota.
- **Vedi chi è in attesa** — la barra mostra quanti messaggi sono in coda, chi li ha inviati e le prime parole.
- **Ricevili quando vuoi tu** — clicca sulla barra o premi il tasto per vedere l'elenco; i messaggi entrano nell'ordine in cui sono arrivati.
- **Messaggi firmati** — inizia un messaggio con `nome 💬 ` e la barra mostra da quale agente arriva.
- **Oppure vai avanti** — passa a un altro pane e la coda viene consegnata in ordine.
- **Gli altri pane restano intatti** — un messaggio a un pane che non stai guardando viene consegnato subito.

## Installazione

Richiede Herdr 0.9.3 o successivo e Node 18 o successivo.

```sh
herdr plugin install navishachiku/herdr-holdback
```

Assegna un tasto in `~/.config/herdr/config.toml` e ricarica con `prefix+shift+r`:

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

## Limiti

- Se una consegna fallisce, lo svuotamento si ferma e il resto resta in coda; nulla va perso.
- Se il focus esce del tutto da Herdr (passi a un'altra app), non viene consegnato nulla finché il focus non passa a un pane diverso.

<details>
<summary>Avanzate: invio dei messaggi, funzionamento interno, configurazione, test</summary>

### Inviare un messaggio

Tutto ciò che vuole mettere in coda il proprio messaggio mentre stai guardando passa da `src/send.mjs`:

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

Il testo prima di ` 💬 ` viene usato come mittente nella notifica; passa `--from` per indicarlo esplicitamente. L'output è una riga JSON: `{"ok":true,"queued":true,"count":2}` se il messaggio è stato trattenuto, `"queued":false` se è stato consegnato subito. I messaggi verso un pane che ospita un agente passano da `herdr agent prompt`, quelli verso un terminale normale da `herdr pane run`.

Questo repository fornisce solo la coda e il punto di ingresso. Far sì che i tuoi agenti lo chiamino al posto di `herdr agent prompt` dipende dal tuo guard di invio.

### Come funziona

| Componente | Ruolo |
| --- | --- |
| `src/daemon.mjs` | Coda sempre attiva in background. Decide se mettere in coda o consegnare, svuota la coda quando il focus se ne va, mantiene la barra sopra il pane. Una richiesta alla volta. |
| `src/on-focus.mjs` | Hook di `pane.focused`. L'evento di Herdr non dice quale pane è stato lasciato, quindi il daemon ricorda da sé il focus precedente e lo inizializza con `herdr pane list` all'avvio. |
| `src/open.mjs`, `src/list.mjs` | L'azione del tasto e l'elenco popup. |
| `src/send.mjs` | Punto di ingresso per chi invia. |

Quando il messaggio più vecchio aspetta da 5 minuti e la casella di input è vuota, l'intera coda viene consegnata in ordine; il daemon lo controlla ogni `check_interval_seconds` (vedi Configurazione).

La coda vive in un file, quindi un daemon riavviato riprende da dove si era fermato. Lo stato è in `~/.local/state/herdr/plugins/herdr-holdback/` (`queue.json`).

### Configurazione

Alla prima esecuzione viene scritto `config.toml` nella cartella di configurazione del plugin (`herdr plugin config-dir herdr-holdback`):

```toml
check_interval_seconds = 30
```

Ogni quanto il daemon controlla se il pane che stai guardando ha messaggi in attesa da 5 minuti. Predefinito: 30 secondi; riavvia il daemon per applicare una modifica. L'attesa di 5 minuti in sé non è configurabile.

### Test

```sh
npm test
```

Esegue il vero daemon e i veri punti di ingresso contro un binario `herdr` finto. I test del popup richiedono `python3` per uno pseudo-terminale.

</details>

## Licenza

MIT
