# PASS — 3-Minute Demo Video

Target length: **2:50–3:00**. Tone: calm, confident, conversational. No
hype, no guarantees, no price predictions. The product is the proof.

## Final script

| Time | Visual | Voiceover |
|---|---|---|
| **0:00–0:25** | X timeline at night, a SOL setup, then an exchange loading screen. | It's 2 a.m. You're scrolling X. A trader you trust posts a setup: long SOL, tight stop, clear target. By the time you open your exchange, bridge funds, and size the position, the move is gone. And the copy-trading bots that promise to solve it? They want custody of your keys. There has to be a better way to act on alpha without surrendering your wallet. |
| **0:25–0:50** | Split screen: social feed, bridge UI, chain logos, custodial bot warning. | The problem isn't information. It's execution. Alpha lives on social, but liquidity lives on-chain—across a dozen networks. Every bridge is a risk. Every manual trade is a race. And every custodial bot is a compromise. Traders need a way to move from idea to execution in one motion, without giving up ownership. |
| **0:50–1:40** | PASS homepage, NEAR Intents funding flow, confidential shards diagram, wallet signing, Hyperliquid execution. | This is PASS. A social execution layer built on NEAR Intents. A trader publishes a plan—entry, target, stop—as a Pass. You see it on X. You click it. And here's where NEAR changes everything: instead of manually bridging, you fund from any chain using NEAR Intents. Your deposit is routed privately through NEAR's confidential shards, so your funding wallet and your trading wallet are never linked on-chain. Once the funds land, you size the trade yourself and sign with your own wallet. Hyperliquid executes. PASS records the receipt. No custody. No front-running. No friction. |
| **1:40–2:20** | Create Pass → X share → Take flow → size $50 → preview → authorize → receipt. Then Agent API. | Watch the flow. A trader publishes a SOL long on PASS. It becomes a link on X. A taker clicks it, reads the thesis, and connects their wallet. They choose their size—fifty dollars. PASS previews the order, the fee, and the exact risk. They authorize. The wallet signs. NEAR Intents handles the cross-chain funding. Hyperliquid fills the order. The receipt appears. And because this is all built on NEAR, builders can plug in through our Agent API—bots that discover Passes and execute pre-signed orders, turning social signals into autonomous strategies. |
| **2:20–2:50** | NEAR chain-abstraction/confidential-intents/agent-economy cards, then PASS end card. | PASS isn't just faster trading. It's a new primitive: a trade plan that anyone can execute, anywhere, without trusting a middleman. NEAR makes it possible—chain abstraction for funding, confidential intents for privacy, and an agent economy for scale. This is what social trading looks like when the infrastructure finally catches up to the conversation. PASS. See a trade. Know the trader. Take the trade. Built on NEAR. Live now at pass-web-dun.vercel.app. |

## ElevenLabs voiceover

The script is chunked into paragraphs in
[`scripts/generate-voiceover.ts`](../scripts/generate-voiceover.ts). The
generator:

1. loads `.env.local` with `dotenv`;
2. reads `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL_ID`, and an optional
   `ELEVENLABS_VOICE_ID` (defaults to a public ElevenLabs voice);
3. calls the ElevenLabs text-to-speech endpoint once per paragraph;
4. concatenates the MP3 chunks into `public/demo/voiceover.mp3`.

Add the credentials to `.env.local` (never commit them):

```bash
ELEVENLABS_API_KEY=your-key
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_VOICE_ID=optional-voice-id
```

Run:

```bash
pnpm generate:voiceover
```

## Background music

Use a royalty-free lo-fi or ambient synth track. Good sources:

- [Pixabay Music](https://pixabay.com/music/) — filter by “lo-fi” or
  “ambient”; check the license on the track page.
- [Bensound](https://www.bensound.com/) — free tracks with attribution terms.

Download the track and save it as:

```text
public/demo/background.mp3
```

Do **not** commit a track you do not have the right to use. The file is
gitignored with the rest of `public/demo/` except `.gitkeep`.

## Screen recording

Record at 1920×1080 or 2560×1440, 30 fps, with the browser at 100% zoom. Use
the flow above as the shot list. Keep the cursor deliberate and pause for one
beat after each state change.

Save the raw recording as:

```text
public/demo/screen-recording.mp4
```

## Automated pipeline

Record the browser flow and assemble the final cut:

```bash
DEMO_BASE_URL=http://localhost:3000 pnpm video:record
pnpm video:build
```

`video:record` writes `public/demo/raw-video/raw-video.webm` using Playwright
at 1280×720. For a local authenticated walk, set `DEMO_SESSION_COOKIE` to a
local session value; set `DEMO_HIDE_DEMO_BANNER=1` to hide the local mock-mode
banner from the recording. `video:build` calls `scripts/build-video.sh`, mixes the voiceover
at full level with the music at 15%, loops the music if needed, and writes
`public/demo/demo.mp4`.

## Manual FFmpeg fallback

This is the same mix the script runs. It keeps the screen video untouched and
ends on the shorter of the video/audio streams:

```bash
ffmpeg \
  -i public/demo/raw-video/raw-video.webm \
  -i public/demo/voiceover.mp3 \
  -stream_loop -1 -i public/demo/background.mp3 \
  -filter_complex "[2:a]volume=0.15[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 192k \
  -shortest public/demo/demo.mp4
```

Check the result:

```bash
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 public/demo/demo.mp4
```

The duration must be under **180 seconds**.
