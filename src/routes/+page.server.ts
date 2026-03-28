import { readFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import type { Command } from '$lib/twitch/chatParser';

export async function load() {
	const [commandsRaw, media, ignoredRaw] = await Promise.all([
		readFile(resolve('commands.json'), 'utf-8'),
		readdir(resolve('media')),
		readFile(resolve('ignored.json'), 'utf-8').catch(() => '[]')
	]);
	const commands: Command[] = JSON.parse(commandsRaw);
	const ignored: string[] = JSON.parse(ignoredRaw);
	return { commands, media, ignored };
}
