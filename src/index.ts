import robotsParser from "robots-parser";
import { XMLParser } from "fast-xml-parser";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		await rssHandler(env);
		return new Response('Hello World!');
	},
	async scheduled(controller: ScheduledController, env: Env): Promise<void> {
		await rssHandler(env);
	}
} satisfies ExportedHandler<Env>;

async function rssHandler(env: Env){
	const keys = (await env.rss.list()).keys
	console.info(keys)

	for (const { name:rssURL } of keys) {
		const allow = await isAllowByRobots(rssURL);
		if (!allow) {
			console.info(`Disallow: ${rssURL}`);
			continue;
		}
		console.info(`Allow: ${rssURL}`);

		const lastItem = await env.rss.get(rssURL) ?? "";

		const rss = await fetchRSS(rssURL);
		console.info(rss.channel.title);

		const rssItems = rss.item;
		const uncheckedRssItems = []
		let latestItem = lastItem;
		for (const item of rssItems) {
			if (item.link === lastItem) {
				break;
			}
			if (!latestItem) {
				latestItem = item.link;
			}
			uncheckedRssItems.push(item);
		}
		console.info(uncheckedRssItems);
		if (uncheckedRssItems.length === 0) {
			console.info("No new items");
			continue;
		}

		await env.rss.put(rssURL, latestItem ?? "");

		const slackMessage = createSlackMessage(
			env.CHANNEL,
			rss.channel.title,
			uncheckedRssItems,
		);

		await env.SLACK_NOTIFIER.send(slackMessage);

		const discordMessage = createDiscordMessage(
			rss.channel.title,
			uncheckedRssItems,
		);

		await env.DQUEUE.send(discordMessage);
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

function createSlackMessage(
	channel: string,
	title: string,
	items: XMLItem[],
) {
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

export function createDiscordMessage(title: string, items: XMLItem[]) {
	let message = `# ${title}\n`;
	for (const item of items) {
		message += `## ${item.title}\n${item.link}\n`;
	}
	return {
		type: "send_message",
		message: {
			content: message,
		},
	};
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
}

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