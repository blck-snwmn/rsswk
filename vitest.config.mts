import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				miniflare:{
					bindings:{
						CHANNEL: "TEST_CHANNEL",
					}
				},
				wrangler: { configPath: './wrangler.toml' },
			},
		},
	},
});
