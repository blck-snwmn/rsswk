import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			remoteBindings: false,
			miniflare: {
				bindings: {
					CHANNEL: "TEST_CHANNEL",
				},
			},
			wrangler: { configPath: "./wrangler.toml" },
		}),
	],
	test: {
	},
});
