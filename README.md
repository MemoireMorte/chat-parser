# TwitchTool

A personal streaming dashboard for Twitch. Monitors chat in real-time, triggers sounds or auto-replies based on custom commands, detects shared URLs and forwards them to Discord, and lets you manage everything through a browser UI.

---

## Features

- **Chat parser** — connects to any Twitch channel (anonymously or via OAuth) and watches for `!commands`
- **Sound triggers** — plays audio files in the browser when a command fires
- **Auto-reply** — sends a message back to chat when a command fires (requires login)
- **URL detection** — catches any URL posted in chat and forwards it to a Discord channel
- **Command manager** — create, edit, enable/disable, and delete commands through the UI; persisted to `commands.json`
- **Media manager** — upload audio files to the server and attach them to commands in one click
- **Ignore list** — block specific users from triggering commands or URL detection
- **Permission levels** — commands can be restricted to everyone, moderators, or the broadcaster only
- **Cooldowns** — per-command cooldown in seconds to prevent spam

---

## Requirements

- [Node.js](https://nodejs.org/) 18+
- npm

---

## Installation

```bash
git clone <repo-url>
cd twitchtool
npm install
```

---

## Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

### `PUBLIC_TWITCH_CLIENT_ID`

1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) and create a new application
2. Set the **OAuth Redirect URL** to `http://localhost:5173` (or your production URL)
3. Copy the **Client ID** into `.env`

### `PUBLIC_TWITCH_REDIRECT_URI`

The URL Twitch will redirect to after login. Use `http://localhost:5173` for local development.

### `DISCORD_WEBHOOK_URL`

1. In your Discord server, go to the target channel → **Edit Channel** → **Integrations** → **Webhooks**
2. Create a new webhook and copy the URL into `.env`

If you don't use the Discord integration, you can leave this variable empty — the app will still work, only URL forwarding will fail silently.

---

## Running

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production

```bash
npm run build
npm run preview
```

---

## First-time setup

### 1. Allow audio

Browsers block audio until the user interacts with the page. On first load a banner will appear at the top — click **Interact** to dismiss it and allow sounds to play.

### 2. Connect to chat

**Anonymous (read-only):** enter a channel name in the input and click **Connect**. Commands and URLs will be detected but the bot cannot send messages back to chat.

**Authenticated:** click **Login with Twitch** in the Chat Parser panel. This grants `chat:read` and `chat:edit` scopes and lets the bot send auto-reply messages. The channel is set to your own username automatically.

### 3. Add commands

In the **Commands** panel:
- Click **+ Add** to create a new command
- Set the **trigger** (the word after `!`, e.g. `hello` → viewers type `!hello`)
- Choose **type**:
  - `message` — the bot sends a text reply to chat
  - `sound` — a sound file plays in the browser
- Set the **cooldown** in seconds (0 = no cooldown)
- Enter the **content**: message text or the filename of an uploaded sound (e.g. `coin.mp3`)
- Choose **permission**: `everyone`, `moderator`, or `broadcaster`
- Click **Save**

### 4. Upload media

In the **Media** panel, select an audio file and click **Upload**. Supported formats: `mp3`, `wav`, `ogg`, `flac`, `aac`, `m4a`, `opus`.

Click **+** next to a file to instantly create a matching sound command for it.

### 5. Ignore users

Click the block icon next to any command match or detected URL to add that user to the ignore list. Ignored users are listed in the Chat Parser panel — click **✕** next to a name to un-ignore them.

---

## Project structure

```
twitchtool/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ChatPanel.svelte       # Chat connection, matches, URL detection
│   │   │   ├── CommandsPanel.svelte   # Command CRUD UI
│   │   │   └── MediaPanel.svelte      # File upload and media list
│   │   └── twitch/
│   │       ├── auth.ts                # Twitch OAuth helpers
│   │       └── chatParser.ts          # IRC WebSocket parser
│   └── routes/
│       ├── api/
│       │   ├── commands/              # GET/POST commands.json
│       │   ├── discord/               # POST to Discord webhook
│       │   ├── ignored/               # GET/POST/DELETE ignored.json
│       │   └── media/                 # GET list, POST upload, GET file
│       ├── +layout.svelte
│       ├── +page.svelte               # Main 3-column layout
│       └── +page.server.ts            # SSR data loader
├── media/                             # Uploaded audio files
├── commands.json                      # Persisted commands
├── ignored.json                       # Persisted ignore list
├── .env                               # Local environment variables (not committed)
└── .env.example                       # Environment variable template
```

---

## Data persistence

All data is stored as plain JSON files at the project root — no database required.

| File | Contents |
|---|---|
| `commands.json` | Array of command objects |
| `ignored.json` | Array of ignored usernames (lowercase) |
| `media/` | Uploaded audio files |
