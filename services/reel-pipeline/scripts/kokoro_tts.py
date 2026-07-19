#!/usr/bin/env python
"""Batch Kokoro TTS helper.

stdin JSON: {"scenes": [{"text": str, "outPath": str}], "voice": str,
"speed": float, "lang": str}
stdout: one JSON line per scene: {"outPath", "seconds", "sampleRate"}
The model loads once per invocation; callers batch scenes for speed.
"""
import json
import os
import sys

KOKORO_DIR = os.environ.get(
    "KOKORO_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools", "kokoro"),
)


def main() -> int:
    payload = json.load(sys.stdin)
    scenes = payload.get("scenes") or []
    if not scenes:
        print(json.dumps({"error": "no scenes"}), file=sys.stderr)
        return 1

    from kokoro_onnx import Kokoro
    import soundfile as sf

    kokoro = Kokoro(
        os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx"),
        os.path.join(KOKORO_DIR, "voices-v1.0.bin"),
    )
    voice = payload.get("voice") or "af_heart"
    speed = float(payload.get("speed") or 1.0)
    lang = payload.get("lang") or "en-us"

    for scene in scenes:
        samples, sample_rate = kokoro.create(scene["text"], voice=voice, speed=speed, lang=lang)
        out_path = scene["outPath"]
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        sf.write(out_path, samples, sample_rate)
        print(json.dumps({
            "outPath": out_path,
            "seconds": round(len(samples) / sample_rate, 3),
            "sampleRate": sample_rate,
        }))
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
