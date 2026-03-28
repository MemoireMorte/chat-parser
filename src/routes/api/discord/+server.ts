import { json, error } from '@sveltejs/kit';
import { DISCORD_WEBHOOK_URL } from '$env/static/private';

export async function POST({ request }) {
	const { url, username } = await request.json();

	if (!url || typeof url !== 'string') {
		throw error(400, 'Missing url');
	}

	const res = await fetch(DISCORD_WEBHOOK_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			content: `**${username}** a partagé un lien: ${url}`
		})
	});

	if (!res.ok) {
		throw error(502, 'Discord webhook failed');
	}

	return json({ ok: true });
}
