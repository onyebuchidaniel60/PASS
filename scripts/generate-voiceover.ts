/**
 * Generate the PASS demo voiceover with ElevenLabs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... \
 *   ELEVENLABS_MODEL_ID=eleven_multilingual_v2 \
 *   ELEVENLABS_VOICE_ID=... \
 *   pnpm exec tsx scripts/generate-voiceover.ts
 *
 * Credentials are loaded from `.env.local` by dotenv, so the operator can keep
 * them out of the shell history. The generated file lands at
 * `public/demo/voiceover.mp3`; the background track is supplied separately
 * (see docs/DEMO_VIDEO.md).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

/**
 * The spoken copy, chunked by section. Each paragraph is synthesized
 * separately so the pauses between sections are deliberate rather than an
 * artifact of one long request.
 */
export const VOICEOVER_PARAGRAPHS = [
  "You see a great trade on X. By the time you open your exchange, the price has moved. Copy-trading bots? They hold your funds. There has to be a better way.",
  "Meet PASS. The social execution layer for Hyperliquid. A trader publishes a trade plan as a Pass: thesis, entry, target, stop. The Pass carries the trader's identity and reputation context, so you know whose plan you're reading. You read it, size it yourself, and authorize with your own wallet. No custody. No copied position. No private key ever leaves your browser.",
  "Here's the flow. A trader opens Create a Pass, picks BTC Long, sets entry, take profit, stop loss, and leverage, then publishes. The Pass becomes a link. They share it on X. A taker clicks the link, reads the thesis, and chooses their own size. PASS previews the exact entry, target, stop, and the 0.05% builder fee before you sign. They connect their wallet, approve a Hyperliquid agent key that can place and cancel trades only, and authorize. The order is signed in the browser and relayed to Hyperliquid Mainnet. The receipt records the fill against the exact Pass version.",
  "Prediction markets work the same way: pick a binary YES/NO market, set a probability, and take the outcome. The market question, side, and probability are visible before you commit. Collateral is USDH.",
  "Under the hood, PASS is non-custodial by design. D-027: a wallet is an execution device, not an account. Executions reference the wallet address, never ownership. The agent key cannot withdraw, transfer, or change account settings. And funding runs through NEAR Intents confidential cross-chain USDC, so your deposit and your Hyperliquid account cannot be linked on-chain. Builders can plug in through the Agent API with a Bearer key, discover live Passes, and relay pre-signed orders. The same execution layer powers the Chrome extension, so PASS shows up where the trade is discovered.",
  "PASS. See a trade. Know the trader. Take the trade. Live on Mainnet at pass-web-dun.vercel.app. Documentation at pass-web-dun.vercel.app/docs.",
] as const;

const OUTPUT = resolve(process.cwd(), "public", "demo", "voiceover.mp3");

/** A public ElevenLabs voice. Override it in .env.local for your brand. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env.local (see docs/DEMO_VIDEO.md).`,
    );
  }
  return value;
}

async function synthesize(
  text: string,
  index: number,
  apiKey: string,
  modelId: string,
  voiceId: string,
): Promise<Buffer> {
  const previous = index > 0 ? VOICEOVER_PARAGRAPHS[index - 1] : undefined;
  const next =
    index < VOICEOVER_PARAGRAPHS.length - 1
      ? VOICEOVER_PARAGRAPHS[index + 1]
      : undefined;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        ...(previous ? { previous_text: previous } : {}),
        ...(next ? { next_text: next } : {}),
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `ElevenLabs request ${index + 1} failed (${response.status}): ${detail}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const apiKey = requiredEnv("ELEVENLABS_API_KEY");
  const modelId = requiredEnv("ELEVENLABS_MODEL_ID");
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;

  await mkdir(dirname(OUTPUT), { recursive: true });

  const chunks: Buffer[] = [];
  for (let index = 0; index < VOICEOVER_PARAGRAPHS.length; index += 1) {
    const text = VOICEOVER_PARAGRAPHS[index]!;
    console.log(
      `[voiceover] ${index + 1}/${VOICEOVER_PARAGRAPHS.length}: ${text.slice(0, 56)}…`,
    );
    chunks.push(await synthesize(text, index, apiKey, modelId, voiceId));
  }

  await writeFile(OUTPUT, Buffer.concat(chunks));
  console.log(`[voiceover] wrote ${OUTPUT} (${chunks.length} paragraphs)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(
      `[voiceover] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
