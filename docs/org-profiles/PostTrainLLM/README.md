# PostTrainLLM

**Mac-local LLM specialist factory.**

PostTrainLLM builds tools for post-training and running small language models
that fit on a single Mac. Our work spans MLX-based local training, WASM
backends for browser inference, and a WebGPU playground for hands-on
experimentation.

## What we ship

- **[PostTrainLLM](https://posttrainllm.com)** — Mac-local LLM specialist factory. Post-training and runtime that fits on one Mac, plus a WebGPU playground. Free, open source.

## What we've shipped (from real git history)

- Python reference implementation, LoRA adapter training, WASM backend, and browser app — four phases shipped in one day (2026-05-22)
- Multi-threaded WASM with a measured 2x speedup (2026-05-26)
- Cloudflare Pages deployment for the playground (2026-05-23)
- Devlog with shipped wins, not plans: https://posttrainllm.com/devlog.html

## Product domains

| Product | URL | What it does |
|---|---|---|
| PostTrainLLM | https://posttrainllm.com | Mac-local LLM factory + WebGPU playground |
| Devlog | https://posttrainllm.com/devlog.html | Build log with measured results |

## Fleet hub

PostTrainLLM is one of the four spotlight products on Sarthak's personal
landing page. The broader fleet directory lives at [SaaS Maker](https://sassmaker.com).

PostTrainLLM is part of the [Foundry fleet](https://sassmaker.com) — a personal
product fleet by Sarthak Agrawal. See the [fleet build log](https://sassmaker.com/build-log)
for the real git history behind PostTrainLLM and the rest of the fleet.

- **Hub**: https://sassmaker.com
- **Fleet build log**: https://sassmaker.com/build-log
- **PostTrainLLM product page**: https://sassmaker.com/p/posttrainllm

## Agent surfaces

PostTrainLLM exposes machine-readable entrypoints for AI agents:

- https://posttrainllm.com/llms.txt
- https://posttrainllm.com/api/ai
- https://posttrainllm.com/index.md
