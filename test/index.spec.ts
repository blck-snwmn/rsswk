// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF, fetchMock } from 'cloudflare:test';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

beforeAll(() => {
	// Enable outbound request mocking...
	fetchMock.activate();
	// ...and throw errors if an outbound request isn't mocked
	fetchMock.disableNetConnect();
});

afterEach(() => {
	vi.restoreAllMocks();
	fetchMock.assertNoPendingInterceptors();
});

describe('test fetch', () => {
	it('call once', async () => {
		const sendSpySlack = vi
		.spyOn(env.SLACK_NOTIFIER, "send")
		.mockImplementation(async () => {});

		const sendSpyDiscord = vi
		.spyOn(env.DQUEUE, "send")
		.mockImplementation(async () => {});

		await env.rss.put('http://example.com', '');

		fetchMock
			.get("http://example.com")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(200, `<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
						<channel>
							<title>CHANNEL_TITLE</title>
							<link>http://example.com/chanel</link>
							<description>this is channel</description>
						</channel>
						<item>
							<title>item_title_1</title>
							<link>http://example.com/chanel/items/1</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
						<item>
							<title>item_title_2</title>
							<link>http://example.com/chanel/items/2</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
					</rdf:RDF>`,
			);

		const request = new IncomingRequest('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);

		expect(sendSpySlack).toBeCalledTimes(1)
		expect(sendSpySlack).toBeCalledWith({
			type: "chat.postMessage",
			body: {
				channel: "TEST_CHANNEL",
				blocks: [
					{
						type: "header",
						text: {
							type: "plain_text",
							text: "CHANNEL_TITLE",
						},
					},
					{
						type: "divider",
					},
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "*item_title_1*\nhttp://example.com/chanel/items/1",
						},
					},
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "*item_title_2*\nhttp://example.com/chanel/items/2",
						},
					},
				],
			},
		});

		expect(sendSpyDiscord).toBeCalledTimes(1)
		expect(sendSpyDiscord).toBeCalledWith({
			type: "send_message",
			message: {
				content: "# CHANNEL_TITLE\n## item_title_1\nhttp://example.com/chanel/items/1\n## item_title_2\nhttp://example.com/chanel/items/2\n",
			},
		});

		const ks = (await env.rss.list()).keys;
		expect(ks).length(1);
		const v = await env.rss.get(ks[0].name);
		expect(v).toBe("http://example.com/chanel/items/1");
	});

	it('responds with Hello World! (integration style)', async () => {
		const sendSpySlack = vi
		.spyOn(env.SLACK_NOTIFIER, "send")
		.mockImplementation(async () => {});

		const sendSpyDiscord = vi
		.spyOn(env.DQUEUE, "send")
		.mockImplementation(async () => {});

		await env.rss.put('http://example.com', '');
		fetchMock
			.get("http://example.com")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(200, `<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
						<channel>
							<title>CHANNEL_TITLE</title>
							<link>http://example.com/chanel2</link>
							<description>this is channel</description>
						</channel>
						<item>
							<title>item_title_1</title>
							<link>http://example.com/chanel2/items/1</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
						<item>
							<title>item_title_2</title>
							<link>http://example.com/chanel2/items/2</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
					</rdf:RDF>`,
				)
				.times(2);

		// 1
		const response = await SELF.fetch('https://example.com');
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);

		expect(await env.rss.get("http://example.com")).toBe("http://example.com/chanel2/items/1");
		
		// 2
		const response2 = await SELF.fetch('https://example.com');
		expect(await response2.text()).toMatchInlineSnapshot(`"Hello World!"`);
		
		expect(await env.rss.get("http://example.com")).toBe("http://example.com/chanel2/items/1");

		expect(sendSpySlack).toBeCalledTimes(1)
		expect(sendSpyDiscord).toBeCalledTimes(1)
	});
});
