#!/usr/bin/env bash
#
# Assemble the PASS demo video from the Playwright recording, voiceover and
# background music. Run from the repository root:
#
#   pnpm video:record
#   pnpm video:build
#
# Inputs:
#   public/demo/raw-video/raw-video.webm   (or any .webm in that folder)
#   public/demo/voiceover.mp3              (scripts/generate-voiceover.ts)
#   public/demo/background.mp3             (royalty-free track; supplied locally)
#
# Output:
#   public/demo/demo.mp4
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT/public/demo/raw-video"
VOICE="$ROOT/public/demo/voiceover.mp3"
MUSIC="$ROOT/public/demo/background.mp3"
OUT="$ROOT/public/demo/demo.mp4"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[video] ffmpeg is required. Install it and retry." >&2
  exit 1
fi

mkdir -p "$RAW_DIR"
RAW="${DEMO_RAW_VIDEO:-$RAW_DIR/raw-video.webm}"
if [[ ! -f "$RAW" ]]; then
  RAW="$(find "$RAW_DIR" -maxdepth 1 -type f -name '*.webm' | sort | head -n 1 || true)"
fi
if [[ -z "$RAW" || ! -f "$RAW" ]]; then
  echo "[video] no raw recording found in $RAW_DIR. Run pnpm video:record first." >&2
  exit 1
fi
if [[ ! -f "$VOICE" ]]; then
  echo "[video] missing $VOICE. Run pnpm generate:voiceover first." >&2
  exit 1
fi
if [[ ! -f "$MUSIC" ]]; then
  echo "[video] missing $MUSIC. Add a royalty-free background track (see README)." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

# ElevenLabs returns one MP3 per paragraph. Concatenated MP3s can carry
# per-chunk headers that make a decoder skip a frame at each boundary. Decode
# the narration to a clean PCM WAV before mixing so the final audio is seamless.
CLEAN_DIR="$(mktemp -d)"
trap 'rm -rf "$CLEAN_DIR"' EXIT
CLEAN_VOICE="$CLEAN_DIR/voiceover.wav"
ffmpeg -y -v error -i "$VOICE" -vn -ac 1 -ar 44100 "$CLEAN_VOICE"

# Voiceover at full level, music at 15%. The music loops if it is shorter than
# the narration. `-shortest` trims the final cut to the shorter stream.
ffmpeg -y \
  -i "$RAW" \
  -i "$CLEAN_VOICE" \
  -stream_loop -1 -i "$MUSIC" \
  -filter_complex "[2:a]volume=0.15[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]" \
  -map 0:v -map "[a]" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -shortest "$OUT"

echo "[video] wrote $OUT"
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error \
    -show_entries format=duration,size \
    -of default=noprint_wrappers=1 "$OUT"
fi
