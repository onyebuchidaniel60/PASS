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
  "It's 2 a.m. You're scrolling X. A trader you trust posts a setup: long SOL, tight stop, clear target. By the time you open your exchange, bridge funds, and size the position, the move is gone. And the copy-trading bots that promise to solve it? They want custody of your keys. There has to be a better way to act on alpha without surrendering your wallet.",
  "The problem isn't information. It's execution. Alpha lives on social, but liquidity lives on-chain—across a dozen networks. Every bridge is a risk. Every manual trade is a race. And every custodial bot is a compromise. Traders need a way to move from idea to execution in one motion, without giving up ownership.",
  "This is PASS. A social execution layer built on NEAR Intents. A trader publishes a plan—entry, target, stop—as a Pass. You see it on X. You click it. And here's where NEAR changes everything: instead of manually bridging, you fund from any chain using NEAR Intents. Your deposit is routed privately through NEAR's confidential shards, so your funding wallet and your trading wallet are never linked on-chain. Once the funds land, you size the trade yourself and sign with your own wallet. Hyperliquid executes. PASS records the receipt. No custody. No front-running. No friction.",
  "Watch the flow. A trader publishes a SOL long on PASS. It becomes a link on X. A taker clicks it, reads the thesis, and connects their wallet. They choose their size—fifty dollars. PASS previews the order, the fee, and the exact risk. They authorize. The wallet signs. NEAR Intents handles the cross-chain funding. Hyperliquid fills the order. The receipt appears. And because this is all built on NEAR, builders can plug in through our Agent API—bots that discover Passes and execute pre-signed orders, turning social signals into autonomous strategies.",
  "PASS isn't just faster trading. It's a new primitive: a trade plan that anyone can execute, anywhere, without trusting a middleman. NEAR makes it possible—chain abstraction for funding, confidential intents for privacy, and an agent economy for scale. This is what social trading looks like when the infrastructure finally catches up to the conversation. PASS. See a trade. Know the trader. Take the trade. Built on NEAR. Live now at pass-web-dun.vercel.app.",
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
          // Keep the five-paragraph NEAR-first cut under the 3-minute limit.
          speed: 1.05,
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
