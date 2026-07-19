# Outreach evidence packages (X4) — 2026-07-18

Ready-to-send copy for getting the first citable third-party URLs. The frame
(per the external analysis): **never** "please add my product" — always "here's
a reproducible benchmark, would you test it for your next update." One credible
engineering artifact beats twenty directory backlinks.

Owner: me (framing) · [user] sends/submits (B-LAUNCH). Show HN is **on hold** —
drafts kept at the bottom, not queued.

Prereq for the strongest version of each: the proof asset should exist first
(CodeVetter competitor benchmark CV6 / HeyPace on-device benchmark HP5). The
GitHub-README + local-wedge versions below work today without them.

---

## CodeVetter

**Target roundup authors** (the pages that already rank for "best AI code review
tools" and never mention CodeVetter): Sonar, getpanto.ai, codeant.ai,
deepsource.com, kinsta.com, blog.logrocket.com, awesomecodereviews.com.

**Outreach email:**
> Subject: A local/desktop entry for your AI code-review roundup — with a
> reproducible benchmark
>
> Hi <name>,
>
> Your <article> is the reference I keep landing on for AI code review tools.
> One category it doesn't cover yet: **local, desktop-first review of
> agent-generated code, where the repo never leaves the machine.** That's what
> CodeVetter does — open source, evidence-backed, runs on your Mac, not a
> PR-comment bot or a cloud service.
>
> I'm not asking to be "added." I built a public, CC0 benchmark of AI code
> review on real agent-written PRs — hand-labeled defects, raw outputs, scoring
> method, and an honest section on where CodeVetter loses:
> https://codevetter.com/benchmark
>
> If you're updating the piece, would you be willing to run it against the same
> PRs? It's free, no account. Happy to send the dataset so you can reproduce.
>
> — <you>

**AlternativeTo:** list CodeVetter as an alternative to CodeRabbit, Greptile,
Qodo, Copilot Code Review. One-liner: *"Open-source, local-first AI code review
for agent-generated code — evidence-backed review on your machine, repo never
leaves the device."* Link home + GitHub + benchmark.

**Product Hunt:** tagline *"Local AI code review for agent-generated code."*
Lead the gallery with the benchmark table. First comment = the wedge + the
benchmark link + "free, no account, open source."

---

## HeyPace

**Target roundup authors:** dottie.ai/blog, shadow.do/blog (the "AI that reads
your screen on Mac" canonical roundup that omits Pace), vellum.ai, lindy.ai,
felloai.com, macaiapps.com; dictation axis: tryvoiceink.com, spokenly.app.

**Outreach email:**
> Subject: An on-device entry for your Mac-assistant roundup — with privacy
> measurements
>
> Hi <name>,
>
> Your roundup on <screen-reading / voice Mac assistants> is great. Pace fits a
> spot the list doesn't cover: **local voice + reads your screen + takes
> actions, $29 one-time, on-device** — the intersection of the dictation tools
> and the cloud screen-agents.
>
> Rather than pitch it, here's data: I measured what actually leaves the device
> for Pace vs the cloud assistants (bytes off-device, destination hosts,
> offline capability), plus latency and task success, all reproducible:
> https://heypace.app/on-device-benchmark
>
> If you update the piece, would you test it? It runs fully offline; you can
> verify the network claims yourself with Little Snitch.
>
> — <you>

**AlternativeTo:** alternative to Superwhisper, Wispr Flow, Raycast AI, Siri,
Dottie. One-liner: *"On-device Mac voice agent that reads your screen and acts —
$29 one-time, works offline, nothing leaves your Mac."*

**Product Hunt:** tagline *"The on-device Mac voice agent that reads your
screen."* Lead with the privacy table (0 bytes off-device). First comment = the
$29-one-time + offline + the benchmark link.

---

## PostTrainLLM

**Target lists/authors:** the awesome-mlx lists (X1) + tutorial authors
apeatling.com, heidloff.net, codersera.com; for the browser wedge: WebLLM /
Transformers.js community. **Disambiguate from PostTrainBench in every message.**

**Outreach email:**
> Subject: A browser-based LLM fine-tuning tool for your MLX/local-training list
>
> Hi <name>,
>
> (Quick note: PostTrainLLM is a tool, not the PostTrainBench paper — different
> thing.) It post-trains small specialist models locally, and it has something I
> haven't seen elsewhere: **fine-tuning that runs in the browser on WebGPU** — a
> live playground, no install, plus a public leaderboard of the models it trains.
>
> Leaderboard + reproducible results: https://posttrainllm.com/leaderboard
> Browser playground: https://posttrainllm.com/playground
>
> If it fits your <awesome-mlx / local-LLM tutorial>, the models are on Hugging
> Face so readers can verify. Happy to answer anything.
>
> — <you>

**AlternativeTo / directories:** alternative to Unsloth / mlx-lm / LM Studio for
the "train, not just run" angle. One-liner: *"Post-train small specialist LLMs
on a Mac — or fine-tune in the browser on WebGPU. Open leaderboard."*

**Product Hunt:** tagline *"Fine-tune a small LLM in your browser."* Lead with
the playground. First comment = the WebGPU wedge + leaderboard + HF models.

---

## Show HN drafts — PARKED (not posting for now, 2026-07-18)

Kept ready so a launch is one step away when you choose to. Post ~9am ET
weekday, be available 3–4h.
- **CodeVetter:** "Show HN: I benchmarked AI code review tools on real
  agent-written PRs" — lead with the benchmark, not the product. Strongest asset.
- **PostTrainLLM:** "Show HN: Fine-tune a small LLM in your browser (WebGPU)."
- **HeyPace:** "Show HN: An on-device Mac voice agent that reads your screen
  ($29, works offline)" — lead with the privacy measurements.
