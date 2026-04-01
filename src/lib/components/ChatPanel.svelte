<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { TwitchChatParser, type CommandMatch, type UrlMatch, type RuntimeCommand } from '$lib/twitch/chatParser';
	import { getLoginUrl, type TwitchAuth } from '$lib/twitch/auth';

	interface Props {
		auth: TwitchAuth | null;
		commands: RuntimeCommand[];
		ignored: string[];
		hasDiscord: boolean;
		onLogout: () => void;
	}

	let { auth, commands, ignored, hasDiscord, onLogout }: Props = $props();

	const STORAGE_KEY = 'twitch-channel-name';

	let channel = $state(browser ? (localStorage.getItem(STORAGE_KEY) ?? '') : '');
	let ignoredSet = $state(new Set(ignored.map((u) => u.toLowerCase())));
	let connected = $state(false);
	let connectError = $state('');
	let matches = $state<CommandMatch[]>([]);
	let urlMatches = $state<UrlMatch[]>([]);
	let parser: TwitchChatParser | null = null;

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
					new Audio(`/api/media/${filename}`).play();
				} else if (match.command.type === 'message') {
					parser?.sendMessage(match.command.content);
				}
				}, auth, hasDiscord ? (match) => {
				urlMatches = [match, ...urlMatches].slice(0, 50);
				fetch('/api/discord', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: match.url, username: match.message.username })
				});
			} : null, [...ignoredSet]);
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
		ignoredSet = new Set([...ignoredSet, normalized]);
		parser?.addIgnored(normalized);
		await fetch('/api/ignored', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: normalized })
		});
	}

	async function unignoreUser(username: string) {
		const normalized = username.toLowerCase();
		ignoredSet = new Set([...ignoredSet].filter((u) => u !== normalized));
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
			<a href={getLoginUrl()} class="rounded bg-twitch px-3 py-1 text-xs text-fg hover:bg-twitch-dark">
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

	<div>
		<p class="mb-2 text-xs text-fg-muted">Watching for commands:</p>
		<div class="flex flex-wrap gap-2">
			{#each commands as cmd}
				<span class="rounded bg-twitch-deeper px-2 py-0.5 text-xs text-twitch-light">!{cmd.trigger}</span>
			{/each}
		</div>
	</div>

	{#if ignoredSet.size > 0}
		<div>
			<p class="mb-2 text-xs text-fg-muted">Ignored users:</p>
			<div class="flex flex-wrap gap-2">
				{#each [...ignoredSet].sort() as username}
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
		<p class="text-xs text-fg-muted">{urlMatches.length} URLs detected</p>
		{#if urlMatches.length === 0}
			<p class="text-sm text-fg-faint">No URLs yet.</p>
		{:else}
			<ul class="flex-1 space-y-2 overflow-y-auto">
				{#each urlMatches as m (m.detectedAt)}
					<li class="flex items-start justify-between gap-2 rounded border border-stroke bg-surface px-3 py-2 text-sm">
						<span>
							<span class="ml-1 {m.message.role === 'broadcaster' ? 'text-yellow-400' : m.message.role === 'moderator' ? 'text-green-400' : 'text-fg-muted'}">{m.message.username}:</span>
							<a href={m.url} target="_blank" rel="noopener noreferrer" class="ml-1 text-twitch-light underline break-all">{m.url}</a>
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
