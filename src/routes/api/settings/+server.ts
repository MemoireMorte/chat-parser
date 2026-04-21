import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const FILE_PATH = resolve('settings.json');

async function readSettings() {
	const raw = await readFile(FILE_PATH, 'utf-8').catch(() => '{}');
	return JSON.parse(raw) as Record<string, unknown>;
}

export async function GET() {
	return json(await readSettings());
}

export async function POST({ request }) {
	const body = await request.json();
	const current = await readSettings();
	const updated = { ...current, ...body };
	await writeFile(FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
	return json({ ok: true });
}
