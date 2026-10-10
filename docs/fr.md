# herdr-holdback

![License](https://img.shields.io/badge/license-MIT-blue)
![Herdr 0.9.3+](https://img.shields.io/badge/herdr-0.9.3%2B-8a2be2)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%E2%80%A2%20Linux%20%E2%80%A2%20Windows-informational)
![Runtime](https://img.shields.io/badge/runtime-Node%2018%2B-5fa04e)

[English](../README.md) | [简体中文](./zh-sc.md) | [繁體中文](./zh-tc.md) | [Español](./es.md) | [Português](./pt.md) | [Русский](./ru.md) | [日本語](./jp.md) | [Français](./fr.md) | [Deutsch](./de.md) | [Tiếng Việt](./vi.md) | [한국어](./ko.md) | [ไทย](./th.md) | [Italiano](./it.md)

<p align="center">
  <a href="#installation">Installation</a> · <a href="#limites">Limites</a>
</p>

> Tu t'es déjà fait GANK par un autre agent en pleine frappe, dans un workflow multi-agents Herdr ?

Tu fais tourner un agent PM et quelques workers dans Herdr. Tu es à mi-chemin d'un prompt pour le PM quand un worker fait son rapport, tapé dans la même zone. Une seule pression sur Entrée, et les deux partent ensemble en une seule requête illisible.

**Avant**

![Sans Holdback : le message d'un worker est tapé dans le prompt du PM que tu étais en train d'écrire, et les deux partent en une seule requête illisible](./media/demo-before.gif)

Holdback les fait patienter. Les messages destinés au pane que tu regardes font la queue dans une barre au-dessus de lui et arrivent quand tu as fini.

**Après**

![Avec Holdback : le message du worker attend dans une barre au-dessus du pane du PM pendant que tu termines et envoies ton propre prompt, puis un clic sur la barre le livre comme un message à part](./media/demo.gif)

- **Ta zone de saisie reste à toi** — rien n'est tapé pendant que tu tapes ; la livraison attend que la zone soit vide.
- **Vois qui attend** — la barre affiche le nombre de messages en file, leurs expéditeurs et leurs premiers mots.
- **Prends-les quand tu veux** — clique sur la barre ou appuie sur la touche pour voir la liste ; les messages entrent dans l'ordre d'arrivée.
- **Messages signés** — commence un message par `nom 💬 ` et la barre indique de quel agent il vient.
- **Ou passe simplement à autre chose** — bascule vers un autre pane et la file est livrée dans l'ordre.
- **Les autres panes ne sont pas touchés** — un message pour un pane que tu ne regardes pas est livré immédiatement.

## Installation

Nécessite Herdr 0.9.3 ou plus récent et Node 18 ou plus récent.

```sh
herdr plugin install navishachiku/herdr-holdback
```

Associe une touche dans `~/.config/herdr/config.toml` et recharge avec `prefix+shift+r` :

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

## Limites

- Si une livraison échoue, la vidange s'arrête et le reste demeure en file ; rien n'est perdu.
- Si le focus quitte entièrement Herdr (tu passes à une autre application), rien n'est livré tant que le focus ne passe pas à un autre pane.

<details>
<summary>Avancé : envoi de messages, fonctionnement interne, configuration, tests</summary>

### Envoyer un message

Tout ce qui veut mettre son message en file pendant que tu regardes passe par `src/send.mjs` :

```sh
node ~/Project/herdr-holdback/src/send.mjs --to w1:p2 "Task-58/TL 💬 gate 1 reached"
```

Le texte avant ` 💬 ` est utilisé comme expéditeur dans la notification ; passe `--from` pour le nommer explicitement. La sortie est une ligne JSON : `{"ok":true,"queued":true,"count":2}` quand le message est retenu, `"queued":false` quand il est livré aussitôt. Les messages vers un pane qui héberge un agent passent par `herdr agent prompt`, vers un terminal ordinaire par `herdr pane run`.

Ce dépôt ne fournit que la file et le point d'entrée. Faire appeler cela par tes agents à la place de `herdr agent prompt` dépend de ton propre garde d'envoi.

### Fonctionnement

| Élément | Rôle |
| --- | --- |
| `src/daemon.mjs` | File persistante en arrière-plan. Décide de mettre en file ou de livrer, vide la file quand le focus part, maintient la barre au-dessus du pane. Une requête à la fois. |
| `src/on-focus.mjs` | Hook `pane.focused`. L'événement de Herdr n'indique pas quel pane a été quitté ; le daemon retient donc lui-même le focus précédent et l'initialise avec `herdr pane list` au démarrage. |
| `src/open.mjs`, `src/list.mjs` | L'action de la touche et la liste en popup. |
| `src/send.mjs` | Point d'entrée pour les expéditeurs. |

Quand le message le plus ancien attend depuis 5 minutes et que la zone de saisie est vide, toute la file est livrée dans l'ordre ; le daemon le vérifie toutes les `check_interval_seconds` (voir Configuration).

La file vit dans un fichier : un daemon redémarré reprend là où il s'était arrêté. L'état se trouve dans `~/.local/state/herdr/plugins/herdr-holdback/` (`queue.json`).

### Configuration

Le premier lancement écrit `config.toml` dans le dossier de configuration du plugin (`herdr plugin config-dir herdr-holdback`) :

```toml
check_interval_seconds = 30
```

Fréquence à laquelle le daemon vérifie si le pane que tu regardes a des messages en attente depuis 5 minutes. Par défaut 30 secondes ; redémarre le daemon pour appliquer un changement. L'attente de 5 minutes elle-même n'est pas configurable.

### Tests

```sh
npm test
```

Lance le vrai daemon et les vrais points d'entrée face à un faux binaire `herdr`. Les tests du popup ont besoin de `python3` pour un pseudo-terminal.

</details>

## Licence

MIT
