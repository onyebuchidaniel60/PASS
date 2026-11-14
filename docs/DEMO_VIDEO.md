# PASS — 3-Minute Demo Video

Target length: **2:50–3:00**. Tone: calm, confident, conversational. No
hype, no guarantees, no price predictions. The product is the proof.

## Final script

| Time | Visual | Voiceover |
|---|---|---|
| **0:00–0:20** | X timeline, a trade post, then a quick cut to an exchange loading screen. | You see a great trade on X. By the time you open your exchange, the price has moved. Copy-trading bots? They hold your funds. There has to be a better way. |
| **0:20–0:50** | PASS homepage and the animated phone hero. | Meet PASS. The social execution layer for Hyperliquid. A trader publishes a trade plan as a Pass: thesis, entry, target, stop. You read it, size it yourself, and authorize with your own wallet. No custody. No copied position. No private key ever leaves your browser. |
| **0:50–1:40** | Create Pass screen. Publish. Share on X. Taker opens the Pass. Take flow: size, preview, wallet, agent approval, authorize. Receipt. Then a prediction-market Pass. | Here's the flow. A trader opens Create a Pass, picks BTC Long, sets entry, take profit, stop loss, and leverage, then publishes. The Pass becomes a link. They share it on X. A taker clicks the link, reads the thesis, and chooses their own size. PASS previews the exact order and the 0.05% builder fee. They connect their wallet, approve a Hyperliquid agent key that can place and cancel trades only, and authorize. The order is signed in the browser and relayed to Hyperliquid Mainnet. The receipt records the fill against the exact Pass version. Prediction markets work the same way: pick a binary YES/NO market, set a probability, and take the outcome. Collateral is USDH. |
| **1:40–2:20** | Architecture diagram, agent key permission list, NEAR Intents funding flow, Settings → Developers. | Under the hood, PASS is non-custodial by design. D-027: a wallet is an execution device, not an account. Executions reference the wallet address, never ownership. The agent key cannot withdraw, transfer, or change account settings. And funding runs through NEAR Intents confidential cross-chain USDC, so your deposit and your Hyperliquid account cannot be linked on-chain. Builders can plug in through the Agent API with a Bearer key, discover live Passes, and relay pre-signed orders. |
| **2:20–2:50** | Homepage hero, then a clean end card with the URL and QR code. | PASS. See a trade. Know the trader. Take the trade. Live on Mainnet at pass-web-dun.vercel.app. Documentation at pass-web-dun.vercel.app/docs. |

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

## Assemble the final video

This mixes the voiceover at full level and the music at 15%, loops the music
if it is shorter than the narration, keeps the screen video untouched, and
ends on the shorter of the video/audio streams:

```bash
ffmpeg \
  -i public/demo/screen-recording.mp4 \
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
