import { json, error } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const PATH = resolve('data/ignored.json');

async function readIgnored(): Promise<string[]> {
	try {
		return JSON.parse(await readFile(PATH, 'utf-8'));
	} catch {
		return [];
	}
}

export async function GET() {
	return json(await readIgnored());
}

export async function POST({ request }) {
	const { username } = await request.json();
	if (!username || typeof username !== 'string') {
		throw error(400, 'Missing username');
	}
	const list = await readIgnored();
	const normalized = username.toLowerCase();
	if (!list.includes(normalized)) {
		list.push(normalized);
		await writeFile(PATH, JSON.stringify(list, null, 2));
	}
	return json({ ok: true });
}

export async function DELETE({ request }) {
	const { username } = await request.json();
	if (!username || typeof username !== 'string') {
		throw error(400, 'Missing username');
	}
	const normalized = username.toLowerCase();
	const list = await readIgnored();
	const filtered = list.filter((u) => u !== normalized);
	await writeFile(PATH, JSON.stringify(filtered, null, 2));
	return json({ ok: true });
}
