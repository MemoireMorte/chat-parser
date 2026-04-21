import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const FILE_PATH = resolve('data/alerts.json');

async function readAlerts() {
	const raw = await readFile(FILE_PATH, 'utf-8').catch(() => '{"subSound":null}');
	return JSON.parse(raw) as { subSound: string | null };
}

export async function GET() {
	return json(await readAlerts());
}

export async function POST({ request }) {
	const body = await request.json();
	const current = await readAlerts();
	const updated = { ...current, ...body };
	await writeFile(FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
	return json({ ok: true });
}
