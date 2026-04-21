import { readFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import { env } from '$env/dynamic/private';
import type { Command } from '$lib/twitch/chatParser';

export async function load() {
	const [commandsRaw, media, ignoredRaw, alertsRaw, settingsRaw] = await Promise.all([
		readFile(resolve('data/commands.json'), 'utf-8'),
		readdir(resolve('data/media')).then((files) => files.filter((f) => !f.startsWith('.'))),
		readFile(resolve('data/ignored.json'), 'utf-8').catch(() => '[]'),
		readFile(resolve('data/alerts.json'), 'utf-8').catch(() => '{"subSound":null}'),
		readFile(resolve('settings.json'), 'utf-8').catch(() => '{}')
	]);
	const commands: Command[] = JSON.parse(commandsRaw);
	const ignored: string[] = JSON.parse(ignoredRaw);
	const alerts: { subSound: string | null; subVolume: number; subEnabled: boolean } = JSON.parse(alertsRaw);
	const settings: { commandsEnabled: boolean; discordEnabled: boolean } = JSON.parse(settingsRaw);
	const hasDiscord = !!env.DISCORD_WEBHOOK_URL;
	return { commands, media, ignored, alerts, settings, hasDiscord };
}
