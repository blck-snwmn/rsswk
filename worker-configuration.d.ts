interface Env {
	rss: KVNamespace;
	SLACK_NOTIFIER: Queue;
	DQUEUE: Queue;
	CHANNEL: string;
	DISCORD_CHANNEL_DEV: string;
}
