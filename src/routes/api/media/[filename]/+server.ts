import { error, json } from '@sveltejs/kit';
import { readFile, rename, writeFile } from 'fs/promises';
import { resolve, basename, extname } from 'path';
import { lookup } from 'mrmime';

const MEDIA_DIR = resolve('media');

export async function GET({ params }) {
	// Sanitize: ensure no path traversal
	const filename = basename(params.filename);
	if (!filename || filename !== params.filename) {
		throw error(400, 'Invalid filename');
	}

	let buffer: Buffer;
	try {
		buffer = await readFile(resolve(MEDIA_DIR, filename));
	} catch {
		throw error(404, 'File not found');
	}

	const mime = lookup(filename) ?? 'application/octet-stream';
	return new Response(buffer, { headers: { 'Content-Type': mime } });
}

export async function PATCH({ params, request }) {
	const oldName = basename(params.filename);
	if (!oldName || oldName !== params.filename) {
		throw error(400, 'Invalid filename');
	}

	const { newName: rawNewName } = await request.json();
	if (!rawNewName || typeof rawNewName !== 'string') {
		throw error(400, 'Missing newName');
	}

	const newName = basename(rawNewName);
	if (!newName || extname(newName).toLowerCase() !== extname(oldName).toLowerCase()) {
		throw error(400, 'New name must keep the same file extension');
	}

	await rename(resolve(MEDIA_DIR, oldName), resolve(MEDIA_DIR, newName));

	// Update any commands that reference the old filename
	const commandsPath = resolve('commands.json');
	const commands = JSON.parse(await readFile(commandsPath, 'utf-8'));
	let changed = false;
	for (const cmd of commands) {
		if (cmd.content === oldName) {
			cmd.content = newName;
			changed = true;
		}
	}
	if (changed) {
		await writeFile(commandsPath, JSON.stringify(commands, null, 2));
	}

	return json({ ok: true, newName, commandsUpdated: changed });
}
