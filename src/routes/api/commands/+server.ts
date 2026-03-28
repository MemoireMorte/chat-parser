import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { Command } from '$lib/twitch/chatParser';

const FILE_PATH = resolve('data/commands.json');

export async function GET() {
	const raw = await readFile(FILE_PATH, 'utf-8');
	const commands: Command[] = JSON.parse(raw);
	return json(commands);
}

export async function POST({ request }) {
	const commands: Command[] = await request.json();
	await writeFile(FILE_PATH, JSON.stringify(commands, null, 2), 'utf-8');
	return json({ ok: true });
}
