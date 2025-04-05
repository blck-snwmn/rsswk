// test/index.spec.ts
import {
	SELF,
	createExecutionContext,
	env,
	fetchMock,
	waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

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

describe("test fetch", () => {
	it("call once", async () => {
		const sendSpySlack = vi
			.spyOn(env.SLACK_NOTIFIER, "send")
			.mockImplementation(async () => {});

		const sendSpyDiscord = vi
			.spyOn(env.DQUEUE, "send")
			.mockImplementation(async () => {});

		await env.rss.put("http://example.com", "");

		fetchMock
			.get("http://example.com")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(
				200,
				`<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
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

		const request = new IncomingRequest("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);

		expect(sendSpySlack).toBeCalledTimes(1);
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

		expect(sendSpyDiscord).toBeCalledTimes(1);
		expect(sendSpyDiscord).toBeCalledWith({
			type: "send_message",
			message: {
				content:
					"# CHANNEL_TITLE\n## item_title_1\nhttp://example.com/chanel/items/1\n## item_title_2\nhttp://example.com/chanel/items/2\n",
			},
		});

		const ks = (await env.rss.list()).keys;
		expect(ks).length(1);
		const v = await env.rss.get(ks[0].name);
		expect(v).toBe("http://example.com/chanel/items/1");
	});

	it("responds with Hello World! (integration style)", async () => {
		const sendSpySlack = vi
			.spyOn(env.SLACK_NOTIFIER, "send")
			.mockImplementation(async () => {});

		const sendSpyDiscord = vi
			.spyOn(env.DQUEUE, "send")
			.mockImplementation(async () => {});

		// 1
		await env.rss.put("http://example.com", "");
		fetchMock
			.get("http://example.com")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(
				200,
				`<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
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
			);

		const response = await SELF.fetch("https://example.com");
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);

		expect(await env.rss.get("http://example.com")).toBe(
			"http://example.com/chanel2/items/1",
		);

		// 2
		fetchMock
			.get("http://example.com")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(
				200,
				`<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
						<channel>
							<title>CHANNEL_TITLE</title>
							<link>http://example.com/chanel2</link>
							<description>this is channel</description>
						</channel>
						<item>
							<title>item_title_2</title>
							<link>http://example.com/chanel2/items/12</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
						<item>
							<title>item_title_2</title>
							<link>http://example.com/chanel2/items/11</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
						<item>
							<title>item_title_1</title>
							<link>http://example.com/chanel2/items/1</link>
							<dc:date>2024-12-26T15:00:00Z</dc:date>
						</item>
					</rdf:RDF>`,
			);
		const response2 = await SELF.fetch("https://example.com");
		expect(await response2.text()).toMatchInlineSnapshot(`"Hello World!"`);

		expect(await env.rss.get("http://example.com")).toBe(
			"http://example.com/chanel2/items/12",
		);

		expect(sendSpySlack).toBeCalledTimes(2);
		expect(sendSpyDiscord).toBeCalledTimes(2);
	});

	it("splits long messages for Discord", async () => {
		const sendSpySlack = vi
			.spyOn(env.SLACK_NOTIFIER, "send")
			.mockImplementation(async () => {});

		const sendSpyDiscord = vi
			.spyOn(env.DQUEUE, "send")
			.mockImplementation(async () => {});

		await env.rss.put("http://example.com", "");

		// Use hardcoded RSS content with many items
		const rssContent = `<rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
				<channel>
					<title>VERY_LONG_CHANNEL_TITLE_FOR_TESTING_MESSAGE_SPLITTING</title>
					<link>http://example.com/chanel</link>
					<description>this is a test channel with many items to verify message splitting</description>
				</channel>
				<item>
					<title>Long item title 1 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/1</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 2 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/2</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 3 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/3</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 4 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/4</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 5 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/5</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 6 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/6</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 7 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/7</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 8 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/8</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 9 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/9</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 10 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/10</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 11 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/11</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 12 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/12</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 13 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/13</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 14 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/14</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 15 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/15</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 16 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/16</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 17 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/17</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 18 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/18</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 19 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/19</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
				<item>
					<title>Long item title 20 with extra text to make it longer and consume more characters in the final message format</title>
					<link>http://example.com/chanel/items/20</link>
					<dc:date>2024-12-26T15:00:00Z</dc:date>
				</item>
			</rdf:RDF>`;

		fetchMock
			.get("http://example.com")
			.intercept({
				path: "/",
				method: "GET",
			})
			.reply(200, rssContent);

		const request = new IncomingRequest("http://example.com");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);

		expect(sendSpySlack).toBeCalledTimes(1);
		
		// Verify that multiple messages were sent to Discord due to content length
		expect(sendSpyDiscord.mock.calls.length).toBeGreaterThan(1);
		
		// Check the format of each message
		for (const call of sendSpyDiscord.mock.calls) {
			const message = call[0] as { 
				type: string; 
				message: { 
					content: string 
				}
			};
			
			// Verify message structure
			expect(message).toHaveProperty("type", "send_message");
			expect(message).toHaveProperty("message");
			expect(message.message).toHaveProperty("content");
			
			// Verify content starts with the channel title
			expect(message.message.content).toContain("# VERY_LONG_CHANNEL_TITLE");
			
			// Verify message is within Discord's limit
			expect(message.message.content.length).toBeLessThanOrEqual(2000);
		}
		
		// Verify that all items are included across all messages
		const allContent = sendSpyDiscord.mock.calls
			.map(call => (call[0] as { message: { content: string } }).message.content)
			.join("");
			
		// Check specific items from the beginning, middle, and end to ensure all content is included
		expect(allContent).toContain("http://example.com/chanel/items/1");
		expect(allContent).toContain("http://example.com/chanel/items/5");
		expect(allContent).toContain("http://example.com/chanel/items/10");
		expect(allContent).toContain("http://example.com/chanel/items/15");
		expect(allContent).toContain("http://example.com/chanel/items/20");
		expect(allContent).toContain("Long item title 1 with extra text");
		expect(allContent).toContain("Long item title 10 with extra text");
		expect(allContent).toContain("Long item title 20 with extra text");
	});
});
