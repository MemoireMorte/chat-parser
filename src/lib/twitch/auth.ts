import { PUBLIC_TWITCH_CLIENT_ID, PUBLIC_TWITCH_REDIRECT_URI } from '$env/static/public';

const TOKEN_KEY = 'twitch-token';
const USERNAME_KEY = 'twitch-username';
const USER_ID_KEY = 'twitch-user-id';

export interface TwitchAuth {
	token: string;
	username: string;
	userId: string;
}

export function getLoginUrl(): string {
	const params = new URLSearchParams({
		client_id: PUBLIC_TWITCH_CLIENT_ID,
		redirect_uri: PUBLIC_TWITCH_REDIRECT_URI,
		response_type: 'token',
		scope: 'chat:read chat:edit user:manage:whispers'
	});
	return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

/** Parses the access token from the URL hash after OAuth redirect */
export function parseTokenFromHash(hash: string): string | null {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	return params.get('access_token');
}

/** Validates the token with Twitch and returns the username and user ID, or null if invalid */
export async function validateToken(token: string): Promise<{ username: string; userId: string } | null> {
	const res = await fetch('https://id.twitch.tv/oauth2/validate', {
		headers: { Authorization: `OAuth ${token}` }
	});
	if (!res.ok) return null;
	const data = await res.json();
	return { username: data.login as string, userId: data.user_id as string };
}

export function getStoredAuth(): TwitchAuth | null {
	const token = localStorage.getItem(TOKEN_KEY);
	const username = localStorage.getItem(USERNAME_KEY);
	const userId = localStorage.getItem(USER_ID_KEY);
	if (!token || !username || !userId) return null;
	return { token, username, userId };
}

export function storeAuth(auth: TwitchAuth): void {
	localStorage.setItem(TOKEN_KEY, auth.token);
	localStorage.setItem(USERNAME_KEY, auth.username);
	localStorage.setItem(USER_ID_KEY, auth.userId);
}

export function clearAuth(): void {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USERNAME_KEY);
}
