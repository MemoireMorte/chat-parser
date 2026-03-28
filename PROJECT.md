# Twitch Tool — Project Reference

Personal streaming tool. Runs on a homelab at `http://localhost:5173`.

## Stack
- **SvelteKit** (Svelte 5 runes) + **TypeScript**
- **Tailwind v4** with custom CSS design tokens (`@theme` in `src/routes/layout.css`)
- **No database** — `commands.json` at the project root is the persistence layer
- **npm**

## Project structure
```
commands.json              # Persisted commands (source of truth)
media/                     # Uploaded media files (served via /api/media/[filename])
src/
  app.html                 # HTML shell
  lib/
    twitch/
      auth.ts              # Twitch OAuth implicit flow helpers
      chatParser.ts        # TwitchChatParser class + Command/RuntimeCommand/CommandMatch types
  routes/
    layout.css             # Tailwind @theme design tokens
    +layout.svelte         # Root layout
    +page.server.ts        # Loads commands.json + media/ list on SSR
    +page.svelte           # Main page (3-column layout)
    api/
      commands/
        +server.ts         # GET/POST commands.json
      media/
        +server.ts         # GET list, POST upload
        [filename]/
          +server.ts       # Serve a media file with correct MIME type
.env                       # PUBLIC_TWITCH_CLIENT_ID, PUBLIC_TWITCH_REDIRECT_URI
```

## Core types (`src/lib/twitch/chatParser.ts`)
```ts
interface Command {
  trigger: string;    // matched as !<trigger> in chat
  type: 'message' | 'sound';
  cooldown: number;   // seconds between triggers
  content: string;    // message text or media filename
  enabled: boolean;
}
type RuntimeCommand = Command & { id: string }; // id never persisted
```

## Twitch OAuth
Implicit grant flow. Requires a Twitch Developer Application (free).
- Scope: `chat:read chat:edit`
- Redirect URI: `http://localhost:5173` (Twitch allows HTTP for localhost)
- Credentials in `.env`:
  ```
  PUBLIC_TWITCH_CLIENT_ID=...
  PUBLIC_TWITCH_REDIRECT_URI=http://localhost:5173
  ```

## Design tokens
Defined in `src/routes/layout.css` as Tailwind v4 `@theme` variables.
Available as Tailwind utilities: `bg-surface`, `text-fg-muted`, `border-stroke`, `bg-twitch`, etc.

| Token | Role |
|---|---|
| `bg` / `surface` / `surface-raised` | Background hierarchy |
| `stroke` / `stroke-subtle` | Borders |
| `fg` / `fg-muted` / `fg-faint` | Text hierarchy |
| `twitch` / `twitch-dark` / `twitch-deeper` / `twitch-light` | Brand colors |
| `success` / `error` | Status colors |

## Known gotchas
- `localStorage` is not available in SSR — guard with `browser` from `$app/environment`
- `crypto.randomUUID()` unavailable in SSR — use the custom `uid()` helper in `+page.svelte`
- Vite intercepts static-looking URLs (e.g. `./media/file.mp3`) with 403 — always use `/api/media/<filename>`
- Audio autoplay is blocked until user interaction — there is an "Interact" banner on load
- Svelte 5 `$effect` tracks all reactive reads inside called functions — wrap with `untrack()` when calling functions that read unrelated reactive state (e.g. `commands`, `matches`)
