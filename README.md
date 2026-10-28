# rsswk
## Run
```bash
$ pnpm run dev
```

## Deploy
```bash
$ pnpm run deploy
```

## Setting
```bash
$ pnpm exec cf kv namespaces create --title rss
```

Set `DISCORD_CHANNEL_DEV` in `worker.env` in `cloudflare.config.ts`.

### queue
see: 
- https://github.com/blck-snwmn/discordworker

## Development

CLI tools (`lefthook`) are managed by [aqua](https://aquaproj.github.io/) with versions pinned in [aqua.yaml](aqua.yaml).

### Install tools

Install aqua itself first (see the [aqua installation guide](https://aquaproj.github.io/docs/install)), then install the pinned tools:

```bash
aqua install
```

### Set up git hooks

[lefthook](lefthook.yml) runs lint and format checks on staged files before each commit. Register the hooks once after cloning:

```bash
lefthook install
```

## Formal specification

[spec/rsswk.qnt](spec/rsswk.qnt) is a [Quint](https://quint-lang.org/) model of how `rssHandler` updates the KV and sends notifications. It compares the current order (put to KV, then send to the queue) with the reversed order (send, then put) when a run fails in between:

| Order | Failure between the two steps | Property that holds |
| --- | --- | --- |
| put → send (current) | the item is marked as read but never sent | `noDup` (no duplicate sends) |
| send → put | the item is sent again on the next run | `noLoss` (no lost items), `noDupUnlessFailed` |

```bash
pnpm run spec:test    # scenario tests (each one shows a violation or a guarantee)
pnpm run spec:verify  # checks the properties that hold, with Apalache (requires Java)
```
