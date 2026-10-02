import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "rsswk",
		compatibilityDate: "2024-12-24",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint: "src/index.ts",
		workersDev: false,
		observability: {
			enabled: true,
		},
		triggers: [
			triggers.scheduled({
				schedule: "0 15 * * *",
			}),
		],
		env: {
			DISCORD_CHANNEL_DEV: bindings.text(""),
			rss: bindings.kv({
				id: "80a0b45a3b3c43979dfc1fbad675a647",
			}),
			DQUEUE: bindings.queue({
				name: "discordqueue",
			}),
		},
	},
});
