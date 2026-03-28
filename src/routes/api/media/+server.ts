import { json } from '@sveltejs/kit';
import { readdir, writeFile } from 'fs/promises';
import { resolve, basename } from 'path';

const MEDIA_DIR = resolve('data/media');

export async function GET() {
	const files = await readdir(MEDIA_DIR);
	return json(files);
}

export async function POST({ request }) {
	const form = await request.formData();
	const file = form.get('file');

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	// Sanitize: strip directory components, keep only the filename
	const filename = basename(file.name);
	if (!filename) {
		return json({ error: 'Invalid filename' }, { status: 400 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(resolve(MEDIA_DIR, filename), buffer);

	return json({ ok: true, filename });
}
