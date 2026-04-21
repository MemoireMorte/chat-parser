<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { PUBLIC_TWITCH_CLIENT_ID } from '$env/static/public';
	import { TwitchChatParser, type CommandMatch, type UrlMatch, type RuntimeCommand, type SubEvent } from '$lib/twitch/chatParser';
	import { getLoginUrl, type TwitchAuth } from '$lib/twitch/auth';

	interface Props {
		auth: TwitchAuth | null;
		commands: RuntimeCommand[];
		ignored: string[];
		hasDiscord: boolean;
		subSound: string | null;
		subVolume: number;
		subEnabled: boolean;
		discordEnabled: boolean;
		media: string[];
		onLogout: () => void;
	}

	let { auth, commands, ignored, hasDiscord, subSound = $bindable(), subVolume = $bindable(), subEnabled = $bindable(), discordEnabled = $bindable(), media, onLogout }: Props = $props();

	const SOUND_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);

	async function saveSubSound(value: string | null) {
		subSound = value;
		await fetch('/api/alerts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subSound: value })
		});
	}

	async function saveDiscordEnabled(value: boolean) {
		discordEnabled = value;
		await fetch('/api/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ discordEnabled: value })
		});
	}

	async function saveSubEnabled(value: boolean) {
		subEnabled = value;
		await fetch('/api/alerts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subEnabled: value })
		});
	}

	async function saveSubVolume(value: number) {
		subVolume = value;
		await fetch('/api/alerts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subVolume: value })
		});
	}

	let subEvents = $state<SubEvent[]>([]);

	const STORAGE_KEY = 'twitch-channel-name';

	let channel = $state(browser ? (localStorage.getItem(STORAGE_KEY) ?? '') : '');
	const ignoredSet = new SvelteSet(untrack(() => ignored.map((u) => u.toLowerCase())));
	let connected = $state(false);
	let connectError = $state('');
	let matches = $state<CommandMatch[]>([]);
	let urlMatches = $state<UrlMatch[]>([]);
	let parser: TwitchChatParser | null = null;

	async function sendWhisper(toUsername: string, message: string) {
		if (!auth) return;
		const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(toUsername)}`, {
			headers: { 'Authorization': `Bearer ${auth.token}`, 'Client-Id': PUBLIC_TWITCH_CLIENT_ID }
		});
		if (!userRes.ok) return;
		const { data } = await userRes.json();
		const toUserId: string | undefined = data?.[0]?.id;
		if (!toUserId) return;
		await fetch(`https://api.twitch.tv/helix/whispers?from_user_id=${auth.userId}&to_user_id=${toUserId}`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${auth.token}`,
				'Client-Id': PUBLIC_TWITCH_CLIENT_ID,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ message })
		});
	}

	function connect() {
		parser?.disconnect();
		const target = auth ? auth.username : channel.trim();
		if (!target) return;
		connectError = '';
		try {
			parser = new TwitchChatParser(target, commands, (match) => {
				matches = [match, ...matches].slice(0, 50);

				if (match.command.type === 'sound') {
					const filename = match.command.content.split('/').pop();
					const audio = new Audio(`/api/media/${filename}`);
					audio.volume = match.command.volume ?? 1;
					audio.play();
				} else if (match.command.type === 'message') {
					parser?.sendMessage(match.command.content);

					if (match.command.id === '__built-in-commands__' && (match.message.role === 'moderator' || match.message.role === 'broadcaster')) {
						const modOnly = commands.filter(c =>
							c.id !== '__built-in-commands__' &&
							c.enabled &&
							c.permission === 'moderator'
						);
						if (modOnly.length > 0) {
							const modMessages = modOnly.filter(c => c.type === 'message').map(c => `!${c.trigger}`);
							const modSounds = modOnly.filter(c => c.type === 'sound').map(c => `!${c.trigger}`);
							const parts: string[] = [];
							if (modMessages.length) parts.push(`Messages: ${modMessages.join(', ')}`);
							if (modSounds.length) parts.push(`Sons: ${modSounds.join(', ')}`);
							sendWhisper(match.message.username, `Pour les modérateurs, il y a aussi: ${parts.join(' | ')}`);
						}
					}
				}
				}, auth, hasDiscord ? (match) => {
				urlMatches = [match, ...urlMatches].slice(0, 50);
				if (discordEnabled) {
					fetch('/api/discord', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: match.url, username: match.message.username, message: match.message.message })
					});
				}
			} : null, [...ignoredSet], (event) => {
				subEvents = [event, ...subEvents].slice(0, 50);
				if (subEnabled && subSound) {
					const audio = new Audio(`/api/media/${encodeURIComponent(subSound)}`);
					audio.volume = subVolume;
					audio.play();
				}
			});
		} catch (e) {
			connectError = (e as Error).message;
			return;
		}
		localStorage.setItem(STORAGE_KEY, channel.trim());
		parser.connect();
		connected = true;
	}

	function disconnect() {
		parser?.disconnect();
		parser = null;
		connected = false;
	}

	async function ignoreUser(username: string) {
		const normalized = username.toLowerCase();
		if (ignoredSet.has(normalized)) return;
		ignoredSet.add(normalized);
		parser?.addIgnored(normalized);
		await fetch('/api/ignored', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: normalized })
		});
	}

	async function unignoreUser(username: string) {
		const normalized = username.toLowerCase();
		ignoredSet.delete(normalized);
		parser?.removeIgnored(normalized);
		await fetch('/api/ignored', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: normalized })
		});
	}

	$effect(() => {
		if (!auth) return;
		untrack(() => connect());
		return () => untrack(() => disconnect());
	});
</script>

<div class="flex flex-col gap-5 overflow-y-auto p-8">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-bold text-twitch-light">Chat Parser</h2>
		{#if auth}
			<div class="flex items-center gap-2 text-xs">
				<span class="text-fg-muted">@{auth.username}</span>
				<button class="text-fg-faint hover:text-fg" onclick={onLogout}>Log out</button>
			</div>
		{:else}
			<a href={getLoginUrl()} rel="external" class="rounded bg-twitch px-3 py-1 text-xs text-fg hover:bg-twitch-dark">
				Login with Twitch
			</a>
		{/if}
	</div>

	{#if !auth}
		<div class="flex gap-2">
			<input
				class="flex-1 rounded border border-stroke bg-surface-raised px-3 py-2 text-fg placeholder-fg-faint focus:border-twitch focus:outline-none"
				placeholder="Channel name"
				bind:value={channel}
				disabled={connected}
				onkeydown={(e) => e.key === 'Enter' && connect()}
			/>
			{#if !connected}
				<button
					class="rounded bg-twitch px-4 py-2 text-fg hover:bg-twitch-dark disabled:opacity-40"
					onclick={connect}
					disabled={!channel.trim()}
				>Connect</button>
			{:else}
				<button
					class="rounded border border-stroke bg-surface-raised px-4 py-2 text-fg-muted hover:bg-surface hover:text-fg"
					onclick={disconnect}
				>Disconnect</button>
			{/if}
		</div>
	{/if}

	{#if connectError}
		<p class="text-sm text-error">{connectError}</p>
	{/if}

	{#if hasDiscord}
		<div class="flex flex-col gap-2">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">Discord</h3>
			<label class="flex cursor-pointer items-center gap-2 rounded border {discordEnabled ? 'border-stroke bg-surface' : 'border-dashed border-stroke bg-bg'} px-3 py-2 text-sm">
				<input
					type="checkbox"
					class="accent-twitch cursor-pointer"
					bind:checked={discordEnabled}
					onchange={() => saveDiscordEnabled(discordEnabled)}
				/>
				<span class="text-fg-muted">Forward links to Discord</span>
			</label>
		</div>
	{/if}

	<div class="flex flex-col gap-2">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-fg-muted">Alerts</h3>
		<div class="flex flex-col gap-2 rounded border {subEnabled ? 'border-stroke bg-surface' : 'border-dashed border-stroke bg-bg'} px-3 py-2 text-sm">
			<div class="flex items-center gap-2">
				<input
					type="checkbox"
					class="accent-twitch cursor-pointer"
					bind:checked={subEnabled}
					onchange={() => saveSubEnabled(subEnabled)}
				/>
				<span class="shrink-0 text-fg-muted">Subscription</span>
				<select
					class="min-w-0 flex-1 rounded border border-stroke bg-surface-raised px-2 py-1 text-fg focus:border-twitch focus:outline-none"
					value={subSound ?? ''}
					onchange={(e) => saveSubSound(e.currentTarget.value || null)}
				>
					<option value="">— none —</option>
					{#each media.filter(f => SOUND_EXTENSIONS.has(f.split('.').pop()?.toLowerCase() ?? '')) as f (f)}
						<option value={f}>{f}</option>
					{/each}
				</select>
				{#if subSound}
					<button
						class="shrink-0 text-fg-faint hover:text-fg"
						title="Preview"
						onclick={() => { const a = new Audio(`/api/media/${encodeURIComponent(subSound!)}`); a.volume = subVolume; a.play(); }}
					>▶</button>
				{/if}
			</div>
			<div class="flex items-center gap-2 text-xs text-fg-muted">
				<span class="shrink-0">Volume — {Math.round(subVolume * 100)}%</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={subVolume}
					oninput={(e) => { subVolume = +e.currentTarget.value; }}
					onchange={(e) => saveSubVolume(+e.currentTarget.value)}
					class="accent-twitch w-full cursor-pointer"
				/>
			</div>
		</div>
	</div>

	<div>
		<p class="mb-2 text-xs text-fg-muted">Watching for commands:</p>
		<div class="flex flex-wrap gap-2">
			{#each commands as cmd (cmd.id)}
				<span class="rounded bg-twitch-deeper px-2 py-0.5 text-xs text-twitch-light">!{cmd.trigger}</span>
			{/each}
		</div>
	</div>

	{#if ignoredSet.size > 0}
		<div>
			<p class="mb-2 text-xs text-fg-muted">Ignored users:</p>
			<div class="flex flex-wrap gap-2">
				{#each [...ignoredSet].sort() as username (username)}
					<span class="flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-xs text-fg-muted">
						{username}
						<button
							class="text-fg-faint hover:text-error"
							title="Un-ignore {username}"
							onclick={() => unignoreUser(username)}
						>✕</button>
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<div class="flex flex-col gap-1">
		<p class="text-xs text-fg-muted">
			{connected ? `Connected to #${auth?.username ?? channel}` : 'Not connected'} — {matches.length} commands
		</p>
		{#if matches.length === 0}
			<p class="text-sm text-fg-faint">No command matches yet.</p>
		{:else}
			<ul class="flex-1 space-y-2 overflow-y-auto">
				{#each matches as m (m.detectedAt)}
					<li class="flex items-start justify-between gap-2 rounded border border-stroke bg-surface px-3 py-2 text-sm">
						<span>
							<span class="font-semibold text-twitch-light">!{m.command.trigger}</span>
							<span class="ml-1 {m.message.role === 'broadcaster' ? 'text-yellow-400' : m.message.role === 'moderator' ? 'text-green-400' : 'text-fg-muted'}">{m.message.username}:</span>
							<span class="ml-1 text-fg">{m.message.message}</span>
						</span>
						<button
							class="shrink-0 text-fg-faint hover:text-error disabled:opacity-30"
							title="Ignore {m.message.username}"
							disabled={ignoredSet.has(m.message.username.toLowerCase())}
							onclick={() => ignoreUser(m.message.username)}
						><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="flex flex-col gap-1">
		<p class="text-xs text-fg-muted">{subEvents.length} subscriptions</p>
		{#if subEvents.length > 0}
			<ul class="flex-1 space-y-2 overflow-y-auto">
				{#each subEvents as e (e.detectedAt)}
					<li class="rounded border border-stroke bg-surface px-3 py-2 text-sm">
						<span class="font-semibold text-twitch-light">{e.username}</span>
						<span class="ml-1 text-fg-muted">{e.type}{e.months && e.months > 1 ? ` · ${e.months} months` : ''}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="flex flex-col gap-1">
		<p class="text-xs text-fg-muted">{urlMatches.length} URLs detected</p>
		{#if urlMatches.length === 0}
			<p class="text-sm text-fg-faint">No URLs yet.</p>
		{:else}
			<ul class="flex-1 space-y-2 overflow-y-auto">
				{#each urlMatches as m (m.detectedAt)}
					<li class="flex items-start justify-between gap-2 rounded border border-stroke bg-surface px-3 py-2 text-sm">
						<span>
							<span class="ml-1 {m.message.role === 'broadcaster' ? 'text-yellow-400' : m.message.role === 'moderator' ? 'text-green-400' : 'text-fg-muted'}">{m.message.username}:</span>
							<a href={m.url} target="_blank" rel="external noopener noreferrer" class="ml-1 text-twitch-light underline break-all">{m.url}</a>
						</span>
						<button
							class="shrink-0 text-fg-faint hover:text-error disabled:opacity-30"
							title="Ignore {m.message.username}"
							disabled={ignoredSet.has(m.message.username.toLowerCase())}
							onclick={() => ignoreUser(m.message.username)}
						><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
