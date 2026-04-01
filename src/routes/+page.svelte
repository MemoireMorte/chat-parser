<script lang="ts">
	import { browser } from '$app/environment';
	import { parseTokenFromHash, validateToken, getStoredAuth, storeAuth, clearAuth, type TwitchAuth } from '$lib/twitch/auth';
	import { type RuntimeCommand } from '$lib/twitch/chatParser';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import CommandsPanel from '$lib/components/CommandsPanel.svelte';
	import MediaPanel from '$lib/components/MediaPanel.svelte';

	function uid(): string {
		return Date.now().toString(36) + Math.random().toString(36).slice(2);
	}

	const SOUND_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);

	let { data } = $props();

	// --- Auth ---
	let auth = $state<TwitchAuth | null>(browser ? getStoredAuth() : null);

	if (browser) {
		const token = parseTokenFromHash(window.location.hash);
		if (token) {
			history.replaceState(null, '', window.location.pathname);
			validateToken(token).then((username) => {
				if (username) {
					auth = { token, username };
					storeAuth(auth);
				}
			});
		}
	}

	function logout() {
		clearAuth();
		auth = null;
	}

	// --- Shared state ---
	let commands = $state<RuntimeCommand[]>(data.commands.map((c) => ({ ...c, id: uid() })));
	let media = $state<string[]>(data.media);
	let ignored = $state<string[]>(data.ignored);

	let interacted = $state(false);

	function renameMedia(oldName: string, newName: string) {
		commands = commands.map((c) => c.content === oldName ? { ...c, content: newName } : c);
	}

	function addCommandFromMedia(filename: string) {
		const ext = filename.split('.').pop()?.toLowerCase() ?? '';
		const trigger = filename.replace(/\.[^.]+$/, '');
		commands = [...commands, {
			id: uid(),
			trigger,
			type: SOUND_EXTENSIONS.has(ext) ? 'sound' : 'message',
			cooldown: 0,
			content: filename,
			enabled: true
		}];
	}
</script>

{#if !interacted}
	<div class="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-twitch bg-twitch-deeper px-6 py-3 font-mono text-sm">
		<span class="text-fg">Browser requires a first interaction before audio can play.</span>
		<button
			class="rounded bg-twitch px-4 py-1.5 text-fg hover:bg-twitch-dark"
			onclick={() => interacted = true}
		>Interact</button>
	</div>
{/if}

<div class="grid h-screen grid-cols-3 divide-x divide-stroke font-mono">
	<ChatPanel {auth} {commands} {ignored} hasDiscord={data.hasDiscord} onLogout={logout} />
	<CommandsPanel bind:commands />
	<MediaPanel bind:media onAddCommand={addCommandFromMedia} onRename={renameMedia} />
</div>
