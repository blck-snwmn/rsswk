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
$ pnpm wrangler kv namespace create rss
```

Set `DISCORD_CHANNEL_DEV` in `[vars]` in `wrangler.toml`.

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
