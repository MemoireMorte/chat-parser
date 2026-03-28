<script lang="ts">
	import type { RuntimeCommand, Command } from '$lib/twitch/chatParser';

	interface Props {
		commands: RuntimeCommand[];
	}

	let { commands = $bindable() }: Props = $props();

	function uid(): string {
		return Date.now().toString(36) + Math.random().toString(36).slice(2);
	}

	let pristine = $state(true);
	let saving = $state(false);
	let saveStatus = $state<'idle' | 'ok' | 'error'>('idle');
	let expanded = $state(new Set<string>());

	function toggle(id: string) {
		const next = new Set(expanded);
		next.has(id) ? next.delete(id) : next.add(id);
		expanded = next;
	}

	function addCommand() {
		const id = uid();
		commands = [...commands, { id, trigger: '', type: 'message', cooldown: 30, content: '', enabled: true, permission: 'everyone' }];
		expanded = new Set([...expanded, id]);
		pristine = false;
	}

	function removeCommand(index: number) {
		commands = commands.filter((_, i) => i !== index);
		pristine = false;
	}

	async function save() {
		saving = true;
		saveStatus = 'idle';
		try {
			const res = await fetch('/api/commands', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(commands.map(({ id: _, ...c }) => c))
			});
			if (res.ok) {
				saveStatus = 'ok';
				pristine = true;
			} else {
				saveStatus = 'error';
			}
		} catch {
			saveStatus = 'error';
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-5 overflow-y-auto p-8">
	<div class="flex items-center gap-3">
		<h2 class="text-xl font-bold text-twitch-light">Commands</h2>
		<button
			class="rounded border border-stroke px-3 py-1 text-sm text-fg-muted hover:border-twitch hover:text-fg"
			onclick={addCommand}
		>+ Add</button>
		<button
			class="rounded bg-twitch px-3 py-1 text-sm text-fg hover:bg-twitch-dark disabled:opacity-40"
			onclick={save}
			disabled={saving || pristine}
		>{saving ? 'Saving…' : 'Save'}</button>
		{#if saveStatus === 'error'}
			<span class="text-sm text-error">Save failed.</span>
		{/if}
	</div>

	<ul class="flex-1 space-y-2 overflow-y-auto">
		{#each commands as cmd, i}
			{@const open = expanded.has(cmd.id)}
			<li class="rounded border {cmd.enabled ? 'border-stroke bg-surface' : 'border-dashed border-stroke bg-bg'}">
				<!-- Always-visible header row -->
				<div class="flex items-center gap-2 px-3 py-2">
					<input
						type="checkbox"
						class="accent-twitch cursor-pointer"
						bind:checked={cmd.enabled}
						onchange={() => pristine = false}
					/>
					<button
						class="flex-1 text-left text-sm {cmd.trigger ? 'text-fg' : 'text-fg-faint'}"
						onclick={() => toggle(cmd.id)}
					>{cmd.trigger || 'untitled'}</button>
					<span class="text-xs text-fg-faint">{cmd.type}</span>
					<button
						class="text-fg-faint hover:text-fg transition-transform {open ? 'rotate-180' : ''}"
						onclick={() => toggle(cmd.id)}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="6 9 12 15 18 9"/>
						</svg>
					</button>
				</div>

				<!-- Expanded body -->
				{#if open}
					<div class="flex flex-col gap-3 border-t border-stroke px-3 pb-3 pt-3">
						<div class="flex items-center gap-2">
							<input
								class="flex-1 rounded border border-stroke bg-surface-raised px-2 py-1 text-fg focus:border-twitch focus:outline-none"
								bind:value={cmd.trigger}
								oninput={() => pristine = false}
								placeholder="trigger"
							/>
							<button class="text-fg-faint hover:text-error" onclick={() => removeCommand(i)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6"/>
									<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
									<path d="M10 11v6M14 11v6"/>
									<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
								</svg>
							</button>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<label class="flex flex-col gap-1 text-xs text-fg-muted">
								Type
								<select
									class="rounded border border-stroke bg-surface-raised px-2 py-1 text-fg focus:border-twitch focus:outline-none"
									bind:value={cmd.type}
									onchange={() => pristine = false}
								>
									<option value="message">message</option>
									<option value="sound">sound</option>
								</select>
							</label>
							<label class="flex flex-col gap-1 text-xs text-fg-muted">
								Cooldown (seconds)
								<input
									type="number"
									min="0"
									class="rounded border border-stroke bg-surface-raised px-2 py-1 text-fg focus:border-twitch focus:outline-none"
									bind:value={cmd.cooldown}
									oninput={() => pristine = false}
								/>
							</label>
						</div>
						<textarea
							class="w-full resize-none rounded border border-stroke bg-surface-raised px-2 py-1 text-fg focus:border-twitch focus:outline-none"
							rows="2"
							bind:value={cmd.content}
							oninput={() => pristine = false}
							placeholder={cmd.type === 'sound' ? 'file.mp3' : 'Message text'}
						></textarea>
						<div class="flex gap-2">
							{#each (['everyone', 'moderator', 'broadcaster'] as Command['permission'][]) as level}
								<button
									class="flex-1 rounded border py-1 text-xs transition-colors {cmd.permission === level ? 'border-twitch bg-twitch-deeper text-twitch-light' : 'border-stroke text-fg-faint hover:border-twitch hover:text-fg'}"
									onclick={() => { cmd.permission = level; pristine = false; }}
								>{level}</button>
							{/each}
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>
