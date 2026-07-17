# HeyPace on-device benchmark — design (HP5)

HeyPace has honest comparison *prose* but no citable *data source*. This is the
proof asset that makes an answer engine name Pace for "most private / on-device
Mac assistant." The wedge is **privacy** — measure and publish exactly what
bytes leave the device for each tool. That single table is the killer citable
fact.

Owner: me (design + measurement protocol) · Prereqs from user: comparator apps
+ a controlled Mac · Output feeds: `/on-device-benchmark` page + `Dataset`
JSON-LD.

## Principle

Same as CodeVetter: reproducible, honest, form-factor-aware, publish where Pace
loses (it already admits latency, no signed DMG, smaller 2B VLM — keep that
candor). The benchmark measures three axes with objective instruments, not
opinion.

## Comparator set

| Tool | Category | Access |
|---|---|---|
| **Pace** | local voice + screen-read + act | ours |
| **Superwhisper** | local dictation | paid |
| **Wispr Flow** | dictation (cloud-assisted) | freemium |
| **Apple Siri / Apple Intelligence** | built-in assistant | free (macOS 26) |
| **Dottie** | screen-read agent | trial |
| **Shadow** | screen-read agent | trial |

Group results by category (dictation vs screen-agent) so comparisons are fair —
Pace's claim is the *intersection*, so it appears in both groups.

## The three measured axes

### 1. Privacy — bytes off the device (THE wedge)
Instrument each tool with a network monitor (Little Snitch + `tcpdump`/`pktap`)
while it performs the task suite **with no user account / logged out where
possible**. Record:
- Total network egress (bytes) during each task.
- Destination hosts (does audio/screen content leave? to whom?).
- Whether the tool functions with **network fully disabled** (airplane test).
Publish a per-tool table: *"For 'summarize this screen,' Pace sent 0 bytes;
Tool X sent N KB to host Y."* This is the citation magnet.

### 2. Latency — time-to-action
Wall-clock from end-of-utterance to action-complete, p50/p95 over N repetitions,
per task. Measured with screen recording + timestamped logs. Report honestly —
if a cloud tool is faster on some task, it's on the page (Pace's own comparison
already concedes RCLI's sub-200ms latency).

### 3. Task success + capability
A fixed suite of representative screen-driven tasks run identically across tools:
- Dictation: transcribe a paragraph (WER vs reference).
- Screen-read: "what does this error say?" / "summarize this page."
- Action: "click Submit", "rename this file to X", "open the third result."
- Offline: repeat the suite airplane-mode; record success/fail.
Score task success rate; note which tasks each tool simply can't do.

Optional 4th axis: resource use (peak RAM/CPU) — cheap to capture, adds credibility.

## Fairness + honesty rules

- Identical hardware, macOS version, tasks, and repetition count for every tool;
  record all of it.
- Logged-out / no-account where the tool allows, to measure the default-privacy
  posture (note where an account is mandatory — itself a privacy finding).
- A "where Pace is behind" section, mirroring the existing `/compared` candor.
- Snapshot with dates + tool versions; re-runnable.

## Reproducibility (public, CC0)

- The task-suite script + task definitions.
- Per-tool per-task raw logs (egress captures summarized — **redact any
  incidental PII from captures before publishing**), latency samples, success
  matrix.
- `heypace-ondevice-benchmark-v1.json` + `Dataset` JSON-LD (CC0,
  `variableMeasured`: egress_bytes, egress_hosts, offline_capable, latency_p50,
  latency_p95, task_success_rate).

## Execution plan

- **[me]** finalize the task suite, the egress-capture protocol, and the scoring
  rubric; define the redaction step for captures.
- **[user]** provision comparator apps (some paid trials) + a clean Mac for
  measurement; run the capture pass with me (or hand me remote access to a
  measurement box).
- **[glm]** build `/on-device-benchmark` from the data: privacy table first
  (the wedge), latency + success tables, "where Pace is behind", reproduce steps,
  `Dataset` + `FAQPage` JSON-LD. Link from nav, `/compared` hub, and all machine
  surfaces; surface the privacy headline in `llms.txt`.

## Risks / honesty flags

- **Measurement rig:** needs a real Mac + the comparator apps installed; this is
  the main external dependency. A one-time snapshot is fine.
- **Capture hygiene:** network captures can contain incidental personal data —
  redact before publishing; publish summaries + destinations, not raw pcaps.
- **Moving target:** Apple Intelligence/Siri changes fast — date-stamp and offer
  a correction path (outreach hook, X4).
- **Small N:** report per-task, not just aggregates.
