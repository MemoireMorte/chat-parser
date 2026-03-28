import { PUBLIC_TWITCH_CLIENT_ID, PUBLIC_TWITCH_REDIRECT_URI } from '$env/static/public';

const TOKEN_KEY = 'twitch-token';
const USERNAME_KEY = 'twitch-username';

export interface TwitchAuth {
	token: string;
	username: string;
}

export function getLoginUrl(): string {
	const params = new URLSearchParams({
		client_id: PUBLIC_TWITCH_CLIENT_ID,
		redirect_uri: PUBLIC_TWITCH_REDIRECT_URI,
		response_type: 'token',
		scope: 'chat:read chat:edit'
	});
	return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

/** Parses the access token from the URL hash after OAuth redirect */
export function parseTokenFromHash(hash: string): string | null {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	return params.get('access_token');
}

/** Validates the token with Twitch and returns the username, or null if invalid */
export async function validateToken(token: string): Promise<string | null> {
	const res = await fetch('https://id.twitch.tv/oauth2/validate', {
		headers: { Authorization: `OAuth ${token}` }
	});
	if (!res.ok) return null;
	const data = await res.json();
	return data.login as string;
}

export function getStoredAuth(): TwitchAuth | null {
	const token = localStorage.getItem(TOKEN_KEY);
	const username = localStorage.getItem(USERNAME_KEY);
	if (!token || !username) return null;
	return { token, username };
}

export function storeAuth(auth: TwitchAuth): void {
	localStorage.setItem(TOKEN_KEY, auth.token);
	localStorage.setItem(USERNAME_KEY, auth.username);
}

export function clearAuth(): void {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USERNAME_KEY);
}
