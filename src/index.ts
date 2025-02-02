import { XMLParser } from "fast-xml-parser";
import robotsParser from "robots-parser";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		await rssHandler(env);
		return new Response("Hello World!");
	},
	async scheduled(controller: ScheduledController, env: Env): Promise<void> {
		await rssHandler(env);
	},
} satisfies ExportedHandler<Env>;

async function rssHandler(env: Env) {
	const keys = (await env.rss.list()).keys;
	console.info("keys", keys);

	for (const { name: rssURL } of keys) {
		const allow = await isAllowByRobots(rssURL);
		if (!allow) {
			console.info(`Disallow: ${rssURL}`);
			continue;
		}
		console.info(`Allow: ${rssURL}`);

		const lastItem = (await env.rss.get(rssURL)) ?? "";

		const rss = await fetchRSS(rssURL);
		console.info(rss.channel.title);

		const uncheckedRssItems = getUncheckedRssItems(rss.item, lastItem);
		console.info("New items", uncheckedRssItems.length);

		if (uncheckedRssItems.length === 0) {
			console.info("No new items");
			continue;
		}

		const latestItem = uncheckedRssItems[0].link;
		await env.rss.put(rssURL, latestItem);
		console.info("Put latest item", latestItem);

		await sendNotifications(env, rss.channel.title, uncheckedRssItems);
	}
}

async function fetchRSS(url: string) {
	const text = await fetch(url).then((r) => r.text());
	const parser = new XMLParser({
		removeNSPrefix: true,
	});
	const xml: XMLContemt = parser.parse(text);
	return xml.RDF;
}

function getUncheckedRssItems(
	rssItems: XMLItem[],
	lastItem: string,
): XMLItem[] {
	const uncheckedRssItems = [];
	for (const item of rssItems) {
		if (item.link === lastItem) break;
		uncheckedRssItems.push(item);
	}
	return uncheckedRssItems;
}

function createSlackMessage(channel: string, title: string, items: XMLItem[]) {
	const blocks = [];
	for (const item of items) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*${item.title}*\n${item.link}`,
			},
		});
	}
	return {
		type: "chat.postMessage",
		body: {
			channel: channel,
			blocks: [
				{
					type: "header",
					text: {
						type: "plain_text",
						text: title,
					},
				},
				{
					type: "divider",
				},
				...blocks,
			],
		},
	};
}

export function createDiscordMessage(
	channel: string,
	title: string,
	items: XMLItem[],
) {
	let message = `# ${title}\n`;
	for (const item of items) {
		message += `## ${item.title}\n${item.link}\n`;
	}
	return {
		type: "send_message",
		channelId: channel,
		message: {
			content: message,
		},
	};
}

async function sendNotifications(env: Env, title: string, items: XMLItem[]) {
	const slackMessage = createSlackMessage(env.CHANNEL, title, items);
	await env.SLACK_NOTIFIER.send(slackMessage);
	console.info("Send slack message");

	const discordMessage = createDiscordMessage(
		env.DISCORD_CHANNEL_DEV,
		title,
		items,
	);
	await env.DQUEUE.send(discordMessage);
	console.info("Send discord message");
}

type XMLContemt = {
	RDF: {
		channel: XMLChannel;
		item: XMLItem[];
	};
};
type XMLChannel = {
	title: string;
	link: string;
	description: string;
};

type XMLItem = {
	title: string;
	link: string;
};

async function isAllowByRobots(url: string) {
	let isAllowed = true;
	try {
		const robotsTextPath = `${new URL(url).origin}/robots.txt`;
		const response = await fetch(robotsTextPath);

		const robots = robotsParser(robotsTextPath, await response.text());
		isAllowed = robots.isAllowed(url) ?? true; // respect robots.txt!
	} catch {
		// ignore
	}
	return isAllowed;
}
