<script lang="ts">
	interface Props {
		media: string[];
		onAddCommand: (filename: string) => void;
		onRename: (oldName: string, newName: string) => void;
	}

	let { media = $bindable(), onAddCommand, onRename }: Props = $props();

	const SOUND_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);

	let uploading = $state(false);
	let renamingFile = $state<string | null>(null);
	let renameValue = $state('');

	async function upload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploading = true;
		const form = new FormData();
		form.append('file', file);
		try {
			const res = await fetch('/api/media', { method: 'POST', body: form });
			if (res.ok) {
				const { filename } = await res.json();
				media = [...media, filename];
			}
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	function startRename(filename: string) {
		renamingFile = filename;
		// Pre-fill with name without extension so cursor lands after the stem
		const dot = filename.lastIndexOf('.');
		renameValue = dot !== -1 ? filename.slice(0, dot) : filename;
	}

	function cancelRename() {
		renamingFile = null;
		renameValue = '';
	}

	async function commitRename(oldName: string) {
		const dot = oldName.lastIndexOf('.');
		const ext = dot !== -1 ? oldName.slice(dot) : '';
		const newName = renameValue.trim() + ext;

		if (!newName || newName === oldName) {
			cancelRename();
			return;
		}

		const res = await fetch(`/api/media/${encodeURIComponent(oldName)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ newName })
		});

		if (res.ok) {
			media = media.map((f) => (f === oldName ? newName : f));
			onRename(oldName, newName);
		}
		cancelRename();
	}
</script>

<div class="flex flex-col gap-5 overflow-y-auto p-8">
	<h2 class="text-xl font-bold text-twitch-light">Media</h2>

	<label class="cursor-pointer rounded border border-stroke px-4 py-2 text-center text-sm text-fg-muted hover:border-twitch hover:text-fg">
		{uploading ? 'Uploading…' : '+ Upload file'}
		<input type="file" class="hidden" onchange={upload} disabled={uploading} />
	</label>

	{#if media.length === 0}
		<p class="text-sm text-fg-faint">No media uploaded yet.</p>
	{:else}
		<ul class="flex-1 space-y-2 overflow-y-auto">
			{#each media as filename}
				{@const isSound = SOUND_EXTENSIONS.has(filename.split('.').pop()?.toLowerCase() ?? '')}
				<li class="flex items-center gap-2 rounded border border-stroke bg-surface px-3 py-2 text-sm text-fg">
					{#if renamingFile === filename}
						<input
							class="min-w-0 flex-1 rounded border border-twitch bg-surface-raised px-2 py-0.5 text-fg focus:outline-none"
							bind:value={renameValue}
							onkeydown={(e) => {
								if (e.key === 'Enter') commitRename(filename);
								if (e.key === 'Escape') cancelRename();
							}}
						/>
						<span class="shrink-0 text-xs text-fg-faint">{filename.slice(filename.lastIndexOf('.'))}</span>
						<button class="shrink-0 text-fg-faint hover:text-fg" title="Confirm" onclick={() => commitRename(filename)}>✓</button>
						<button class="shrink-0 text-fg-faint hover:text-fg" title="Cancel" onclick={cancelRename}>✕</button>
					{:else}
						{#if isSound}
							<button
								class="shrink-0 text-fg-faint hover:text-fg"
								title="Play"
								onclick={() => new Audio(`/api/media/${filename}`).play()}
							>▶</button>
						{/if}
						<span class="min-w-0 flex-1 truncate">{filename}</span>
						<div class="flex shrink-0 gap-2">
							<button
								class="text-fg-faint hover:text-fg"
								title="Rename"
								onclick={() => startRename(filename)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
							</button>
							<button
								class="text-fg-faint hover:text-twitch-light"
								title="Add command"
								onclick={() => onAddCommand(filename)}
							>+</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
