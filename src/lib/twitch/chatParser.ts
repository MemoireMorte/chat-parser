export interface Command {
	trigger: string;
	type: 'message' | 'sound';
	/** Duration in seconds before the command can be triggered again */
	cooldown: number;
	content: string;
	enabled: boolean;
	permission: 'everyone' | 'moderator' | 'broadcaster';
}

/** Command with a runtime-only UID, assigned on load and never persisted */
export type RuntimeCommand = Command & { id: string };

export type UserRole = 'broadcaster' | 'moderator' | 'viewer';

export interface ChatMessage {
	username: string;
	message: string;
	channel: string;
	role: UserRole;
}

export interface CommandMatch {
	command: RuntimeCommand;
	message: ChatMessage;
	detectedAt: Date;
}

export interface UrlMatch {
	url: string;
	message: ChatMessage;
	detectedAt: Date;
}

import type { TwitchAuth } from './auth';

export class TwitchChatParser {
	private ws: WebSocket | null = null;
	private channel: string;
	private commands: RuntimeCommand[];
	private onCommand: (match: CommandMatch) => void;
	private onUrl: ((match: UrlMatch) => void) | null;
	private auth: TwitchAuth | null;
	private ignored: Set<string>;
	private _connected = false;
	/** Tracks the last trigger timestamp (ms) per command id, owned by the parser */
	private lastTriggeredAt = new Map<string, number>();

	constructor(
		channel: string,
		commands: RuntimeCommand[],
		onCommand: (match: CommandMatch) => void,
		auth: TwitchAuth | null = null,
		onUrl: ((match: UrlMatch) => void) | null = null,
		ignored: string[] = []
	) {
		const sanitized = channel.toLowerCase().replace(/^#/, '');
		// Twitch usernames: 1–25 chars, alphanumeric + underscores only.
		// Reject anything else to prevent IRC command injection.
		if (!/^\w{1,25}$/.test(sanitized)) {
			throw new Error(`Invalid channel name: "${channel}"`);
		}
		this.channel = sanitized;
		this.commands = commands;
		this.onCommand = onCommand;
		this.onUrl = onUrl;
		this.auth = auth;
		this.ignored = new Set(ignored.map((u) => u.toLowerCase()));
	}

	get connected(): boolean {
		return this._connected;
	}

	addIgnored(username: string): void {
		this.ignored.add(username.toLowerCase());
	}

	removeIgnored(username: string): void {
		this.ignored.delete(username.toLowerCase());
	}

	connect(): void {
		if (this.ws) this.disconnect();

		// Anonymous read-only connection using a random justinfan nick
		const nick = `justinfan${Math.floor(Math.random() * 99999)}`;
		this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

		this.ws.onopen = () => {
			this.ws!.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
			if (this.auth) {
				this.ws!.send(`PASS oauth:${this.auth.token}`);
				this.ws!.send(`NICK ${this.auth.username}`);
			} else {
				this.ws!.send(`NICK ${nick}`);
			}
			this.ws!.send(`JOIN #${this.channel}`);
			this._connected = true;
			console.log(`[TwitchChatParser] Connected to #${this.channel} as ${this.auth?.username ?? 'anonymous'}`);
		};

		this.ws.onmessage = (event: MessageEvent) => {
			this.handleRaw(event.data as string);
		};

		this.ws.onclose = () => {
			this._connected = false;
			console.log('[TwitchChatParser] Disconnected');
		};

		this.ws.onerror = (e) => {
			console.error('[TwitchChatParser] WebSocket error', e);
		};
	}

	sendMessage(message: string): void {
		if (!this.ws || !this._connected || !this.auth) return;
		this.ws.send(`PRIVMSG #${this.channel} :${message}`);
	}

	disconnect(): void {
		this.ws?.close();
		this.ws = null;
		this._connected = false;
	}

	private handleRaw(raw: string): void {
		// Twitch may send multiple lines in one message
		for (const line of raw.split('\r\n')) {
			if (!line) continue;

			// Respond to PING to keep connection alive
			if (line.startsWith('PING')) {
				this.ws?.send('PONG :tmi.twitch.tv');
				continue;
			}

			const parsed = this.parsePrivmsg(line);
			if (parsed && !this.ignored.has(parsed.username.toLowerCase())) {
				this.checkCommands(parsed);
				this.checkUrls(parsed);
			}
		}
	}

	private parsePrivmsg(line: string): ChatMessage | null {
		// Format: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
		const match = line.match(/^@(\S+) :(\w+)!\w+@\S+ PRIVMSG (#\S+) :(.+)$/);
		if (!match) return null;

		const badges = match[1].match(/(?:^|;)badges=([^;]*)/)?.[1] ?? '';
		const role: UserRole =
			badges.includes('broadcaster') ? 'broadcaster' :
			badges.includes('moderator') ? 'moderator' :
			'viewer';

		return {
			username: match[2],
			channel: match[3],
			message: match[4],
			role
		};
	}

	private checkUrls(msg: ChatMessage): void {
		if (!this.onUrl) return;
		const urls = msg.message.match(/https?:\/\/[^\s]+/g);
		if (!urls) return;
		const detectedAt = new Date();
		for (const url of urls) {
			this.onUrl({ url, message: msg, detectedAt });
		}
	}

	private checkCommands(msg: ChatMessage): void {
		// Extract all !word tokens from the message
		const tokens = msg.message.match(/!(\w+)/g);
		if (!tokens) return;

		const now = Date.now();

		for (const token of tokens) {
			const word = token.slice(1).toLowerCase(); // strip the leading '!'
			const command = this.commands.find((c) => c.trigger.toLowerCase() === word);
			if (!command || !command.enabled) continue;

			const { role } = msg;
			if (command.permission === 'broadcaster' && role !== 'broadcaster') continue;
			if (command.permission === 'moderator' && role !== 'broadcaster' && role !== 'moderator') continue;

			const lastTriggered = this.lastTriggeredAt.get(command.id) ?? -Infinity;
			if ((now - lastTriggered) / 1000 < command.cooldown) continue;

			this.lastTriggeredAt.set(command.id, now);
			this.onCommand({ command, message: msg, detectedAt: new Date() });
		}
	}
}
