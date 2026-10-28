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

[spec/rsswk.qnt](spec/rsswk.qnt) is a [Quint](https://quint-lang.org/) model of how `rssHandler` saves the last seen item to KV and then sends notifications to the queue. It checks `noLoss`: every item marked as read in KV has been sent.

`noLoss` does not hold for the current implementation. If a run fails after the KV put and before all messages are sent, the unsent items are never sent on later runs.

```bash
pnpm run spec:test    # scenario tests
pnpm run spec:verify  # checks noLoss with Apalache (requires Java); reports a counterexample
```
