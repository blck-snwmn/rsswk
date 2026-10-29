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

[spec/rsswk.qnt](spec/rsswk.qnt) is a [Quint](https://quint-lang.org/) model of how `rssHandler` sends notifications to the queue and then saves the last seen item to KV. It checks these properties:

| Property | Meaning | Result |
| --- | --- | --- |
| `noLoss` | every item marked as read in KV has been sent | holds |
| `noDup` | no item is sent twice | does not hold |
| `noDupUnlessFailed` | duplicates are sent only after a run has failed | holds |

Sending before the KV put means a failed run is retried on the next run, so no item is lost. If a run fails after some messages were sent, the next run sends those items again.

```bash
pnpm run spec:test         # scenario tests
pnpm run spec:verify:loss  # checks noLoss with Apalache (requires Java)
pnpm run spec:verify:dup   # checks noDupUnlessFailed with Apalache (requires Java)
```

The [Spec workflow](.github/workflows/spec.yaml) runs these when the model, `src/index.ts` or the Quint version changes. It checks the model, not the code: update the model when you change how `rssHandler` sends or saves items.
