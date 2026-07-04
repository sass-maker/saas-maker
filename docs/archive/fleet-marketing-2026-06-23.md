# Fleet Marketing Playbook — 2026-06-23

For each product: the positioning, the audience, the channel, the demo, and a
**devil's advocate** take on why it might not work. No hype — just honest
assessment of what's ready to market and what isn't.

---

## Tier 1 — Market Now

### saas-maker (The Foundry)
**Positioning:** Ship SaaS without rebuilding billing/auth/widgets every time.
**Audience:** Indie hackers, small teams, solo founders who keep reinventing plumbing.
**Channel:** Dev Twitter, HN, indiehackers.com.
**Demo:** "From idea to deployed SaaS in 10 minutes" — screen record building a
real product using the Foundry's blocks, SDK, and cockpit.
**Why now:** The cockpit + SDK + widget system is a real moat. Nobody else
combines these into one toolkit.
**Devil's advocate:** "Ship SaaS faster" is the most crowded category in dev
tools. Vercel, Supabase, Clerk, Stripe — each owns a slice. Why would someone
adopt a meta-framework that wraps all of these when they could use the
underlying tools directly? **Counter:** The value isn't wrapping — it's the
opinionated integration. The cockpit, the widget SDK, the task system, the
feedback board — these are things you'd build anyway. The Foundry ships them
pre-integrated. The risk is that the integration becomes a constraint when
you need to customize. **Mitigation:** Document escape hatches clearly. Show
cases where people ejected specific parts.

### free-ai (Free AI Gateway)
**Positioning:** Free LLM API, OpenAI-compatible, just change the base URL.
**Audience:** AI app builders who don't want to pay OpenAI rates, hobbyists,
students, prototypers.
**Channel:** r/LocalLLaMA, HN, dev Twitter, Reddit r/chatgptcoding.
**Demo:** "Replace `api.openai.com` with `free-ai.fleet.cc` — that's it.
30+ models, zero cost."
**Why now:** 30+ free providers fronted by one OpenAI-compatible endpoint.
The perf PR (embedding cache, request coalescing) makes it fast, not just
free.
**Devil's advocate:** "Free" is not a sustainable positioning. The providers
are free today but may rate-limit or shut down tomorrow. Reliability is the
real question — if the gateway routes to a provider that's down, the user's
app breaks. **Counter:** The health snapshot cache (perf fix) + request
coalescing means the gateway is resilient. But the core risk remains: you're
dependent on free tiers. **Mitigation:** Be transparent about reliability
(99.x% uptime page). Position as "prototyping tier" not "production tier."
When users need production reliability, they upgrade to paid providers
through the same gateway.

### rolepatch (AI Resume Tailoring)
**Positioning:** AI-tailored resumes with fit scoring, cover letters, and
interview prep — all from one LaTeX editor.
**Audience:** Job seekers who care about resume quality (tech, finance,
consulting).
**Channel:** LinkedIn, r/jobs, r/cscareerquestions, career Twitter.
**Demo:** Screen record: paste a JD, watch the resume tailor in real-time
(streaming — after perf fix), see the fit score, generate a cover letter.
**Why now:** rolepatch.com is live. The streaming AI fix (perf PR) makes the
demo dramatically better — content appears in 1s instead of 15s.
**Devil's advocate:** Resume tailoring is a feature, not a product. Every AI
wrapper (Teal, Rezi, Kickresume) does this. Why would someone use rolepatch
over a funded competitor? **Counter:** The LaTeX editor is the differentiator
— it produces ATS-clean, professionally typeset resumes, not the generic
Word-doc output of most tools. The fit score is also more rigorous than
competitors. **But:** the LaTeX angle limits the audience to people who
care about typography. Most job seekers just want a PDF. **Mitigation:**
Offer a "simple mode" that hides the LaTeX. Lead with the fit score and
tailoring, not the editor.

### codevetter (Local-First AI Code Review)
**Positioning:** AI code review that runs on your machine. Your code never
leaves your device.
**Audience:** Security-conscious devs, enterprise teams, open-source
maintainers.
**Channel:** HN, dev Twitter, r/cybersecurity, enterprise security blogs.
**Demo:** Open a PR in codevetter, watch findings stream in (0.3s
time-to-first-finding after perf fix), show the blast-radius analysis.
**Why now:** codevetter.com is live. The streaming fix (perf PR) transforms
the demo from "wait 8s" to "instant findings."
**Devil's advocate:** "Local-first" is a nice privacy story but most devs
don't care — they already send code to GitHub, Vercel, and CI. The real
competition is GitHub Copilot, CodeRabbit, and Greptile, which have
distribution via GitHub integration. A desktop app has to be installed,
updated, and maintained. **Counter:** The privacy angle matters for
enterprise and regulated industries (finance, healthcare, government).
That's a real, paying audience. **But:** enterprise sales is a completely
different motion than dev tool adoption. You need SOC2, security reviews,
and a sales team. **Mitigation:** Start with the open-source maintainer
audience (free tier) and build enterprise features (SSO, audit logs) as
paid add-ons. The streaming + blast-radius features are genuinely
differentiated.

### high-signal (Daily AI Intelligence Brief)
**Positioning:** AI-curated market intelligence in 5 minutes instead of 2
hours of Bloomberg.
**Audience:** Founders, traders, analysts, busy professionals who need
market awareness.
**Channel:** Twitter, LinkedIn, fintech newsletters.
**Demo:** "Open highsignal.app — your brief is already loaded. Stocks,
ideas, trends, scored by AI."
**Why now:** highsignal.app is live. The edge cache fix (perf PR) makes the
brief load instantly — premium feel.
**Devil's advocate:** "AI-curated news" is the most hyped and most failed
category of 2024-2025. Nuzzel died. Artifact pivoted and died. Every AI
news app promises "personalized, curated, fast" and most users revert to
Twitter. The problem isn't curation — it's habit. **Counter:** High-signal
isn't a news reader — it's a daily brief that's pre-computed. You don't
scroll; you read one page. That's a different habit loop (morning email
replacement, not feed replacement). **But:** the brief needs to be genuinely
useful, not just summarized headlines. If the AI synthesis is shallow,
users will notice within a week. **Mitigation:** Focus on the signal
scoring (hit-rate stats) as the quality metric. Show users that the brief
has a measurable track record of surfacing things that moved markets.

### karte (AI Link-in-Bio)
**Positioning:** Link-in-bio with an AI chatbot that answers questions about
you.
**Audience:** Creators, freelancers, indie hackers who want their link page
to do more.
**Channel:** Twitter creator communities, TikTok, indie hackers.
**Demo:** "Send a link to a brand — they can chat with your portfolio
instead of scrolling a list of links."
**Why now:** karte.cc is live. The "roast my link-in-bio" mode is
viral-worthy. FK indexes fix (perf PR) makes profile pages load fast.
**Devil's advocate:** Link-in-bio is the most commoditized product on the
internet. Linktree has 50M users and a $1.3B valuation. Bento, Beacons,
and Carrd all compete. The AI chat angle is interesting but — does anyone
actually want to chat with a link page? The use case is unclear. **Counter:**
The chat isn't for the owner — it's for visitors. A brand partner visits
your karte, asks "what's their audience size?" or "do they have experience
with SaaS?" and gets an instant answer. That's genuinely useful for
creator-brand partnerships. **But:** this requires the AI to actually know
about the person, which means the owner has to fill in a profile. If the
profile is empty, the chat is useless. **Mitigation:** Make profile setup
frictionless — import from LinkedIn/Twitter. The "roast" mode is the hook
to get people to fill in their profile.

---

## Tier 2 — Fix One Thing, Then Market

### everythingrated (Multi-Axis Ratings)
**Positioning:** Rate things across multiple dimensions, not just 1-5 stars.
**Audience:** Product reviewers, comparison shoppers, community moderators.
**Channel:** r/ProductManagement, r/UXDesign, product Twitter.
**Demo:** "Rate a laptop across battery, screen, keyboard, value — see the
multi-dimensional leaderboard."
**Why now:** The full-table ratings scan fix (perf PR) makes directory pages
fast. But the landing page needs a concrete example.
**Devil's advocate:** "Multi-axis ratings" is a feature, not a product.
Amazon, Yelp, and IMDB all have multi-axis ratings. What does
everythingrated offer that they don't? **Counter:** The difference is that
anyone can create a directory for anything. It's a platform, not a single
site. **But:** Platform plays require critical mass — if no one rates
anything, the directories are empty. **Mitigation:** Seed 3-5 directories
with real data (laptops, AI tools, programming languages). Show the value
before asking users to contribute.

### starboard (GitHub Stars Organizer)
**Positioning:** Search your GitHub stars like you search your brain.
**Audience:** Developers with 500+ starred repos they'll never find again.
**Channel:** Dev Twitter, HN, r/programming.
**Demo:** "Search 'auth library' across your 800 starred repos — get
semantic results in 200ms."
**Why now:** Semantic search is the differentiator. But sync is slow
(sequential GitHub list fetching) — the perf PR fixes this.
**Devil's advocate:** GitHub's own search is improving. They recently added
starred repo search. If GitHub ships this natively, starboard is dead.
**Counter:** GitHub's search is keyword-based, not semantic. "Auth library"
won't find a repo starred as "OAuth provider." And starboard adds
organization (lists, tags, RAG over READMEs) that GitHub doesn't. **But:**
the dependency on GitHub's API is a platform risk — they could rate-limit
or change the API at any time. **Mitigation:** Cache aggressively (the perf
PR does this). Make the product useful even with stale data. And diversify
beyond GitHub (GitLab, Bitbucket) if it gains traction.

### reader (Research Library)
**Positioning:** Capture, annotate, and AI-chat with your research papers.
**Audience:** PhD students, researchers, academics.
**Channel:** Academic Twitter, ResearchGate, r/PhD, r/GradSchool.
**Demo:** "Search 'transformer attention mechanisms' across your library —
FTS5 results as you type. Chat with the AI about findings."
**Why now:** The FTS5 search fix (planned) is critical — search is the core
feature. Don't market until it's fast.
**Devil's advocate:** Zotero, Mendeley, and Paperpile own this market. They
have citation management, PDF annotation, and institutional integrations.
Reader is a newer, less-funded competitor. **Counter:** Reader's AI chat is
the differentiator — none of the incumbents have it natively. And the
web-first approach (no desktop app) is simpler. **But:** academics are slow
to adopt new tools. The switching cost from Zotero is high (years of
library data). **Mitigation:** Offer Zotero import. Make the AI chat so
compelling that it's worth the switch. Focus on the "chat with your
papers" angle, not "replace Zotero."

### research-papers (Semantic Paper Search)
**Positioning:** Google Scholar but with semantic search and quality
signals.
**Audience:** ML researchers, data scientists, academics.
**Channel:** Academic Twitter, r/MachineLearning, HN.
**Demo:** "Search 'efficient attention for long sequences' — get 488k
papers ranked by semantic similarity, filtered by citation quality."
**Why now:** The vector index fix (perf PR) makes semantic search 50-100X
faster. The caching fix makes repeated queries instant.
**Devil's advocate:** Semantic Scholar already exists and is funded by
Allen AI. Google Scholar has 300M users. What does research-papers do that
they don't? **Counter:** The quality signals (overlay data, citation
corrections, review ratings from OpenReview) are unique. Semantic Scholar
has citation graphs but not review-quality scoring. **But:** the audience
(academics) is small and hard to monetize. **Mitigation:** Don't try to
monetize directly. Use it as a traffic driver for other fleet products
(reader, swe-interview-prep). Or offer an API for other research tools.

### swe-interview-prep (SWE Learning OS)
**Positioning:** SWE interview prep with FSRS spaced repetition and AI
tutoring.
**Audience:** Software engineers preparing for interviews.
**Channel:** r/cscareerquestions, r/leetcode, r/interviews, dev Twitter.
**Demo:** "Practice a system design problem. The AI tutors you. Your
mastery is tracked with FSRS — review the right concepts at the right
time."
**Why now:** The bundle size fix (planned) will improve LCP. The FSRS
angle is scientifically credible.
**Devil's advocate:** Interview prep is the most saturated dev tool
category. LeetCode, AlgoExpert, Pramp, Interviewing.io, Grokking — all
funded, all established. What does this offer that they don't? **Counter:**
The FSRS spaced repetition system is genuinely novel for interview prep.
No competitor tracks concept mastery over time. **But:** the content
library needs to be deep enough to be useful. If there are only 50
concepts, users exhaust it in a week. **Mitigation:** Focus on the learning
OS angle — it's not just interview prep, it's a long-term skill tracker.
The import feature (Anki cards) lets users bring their own content.

### truehire (Verified GitHub Scoring)
**Positioning:** Stop reading resumes — read their GitHub.
**Audience:** Technical recruiters, engineering managers.
**Channel:** LinkedIn, recruiting communities, HR tech blogs.
**Demo:** "Enter a GitHub username — get a verified score based on craft
signals, contribution patterns, and work history."
**Why now:** The verification scan fix (perf PR) + edge cache makes profile
pages fast. These pages are the marketing surface.
**Devil's advocate:** GitHub scoring is a solved problem — GitClear,
SourceLevel, and GitHub's own contribution graph all exist. And GitHub
activity doesn't correlate well with job performance (many great engineers
have empty GitHub profiles). **Counter:** Truehire's "verified" angle
(employer verifications) adds a trust layer that pure GitHub scoring lacks.
**But:** the verification process requires employer participation, which is
a chicken-and-egg problem. **Mitigation:** Start with the public scoring
(craft signals, contributions) and add verifications as a premium feature.
The recruiter audience pays well if the tool saves them 30 minutes per
candidate.

### today-little-log (Life PWA)
**Positioning:** A quiet, fast, offline-first life journal.
**Audience:** Productivity enthusiasts, quantified-self practitioners.
**Channel:** r/productivity, r/QuantifiedSelf, r/getdisciplined.
**Demo:** "Open the app — it's already loaded (works offline). Log your
day in 10 seconds. See patterns over time."
**Why now:** The PWA caching fix (planned) makes offline work seamless —
which is a marketing point itself.
**Devil's advocate:** Life journaling apps are a dime a dozen. Day One,
Journey, Stoic, Reflect — all polished, all funded. Why would someone
switch? **Counter:** The PWA + offline-first approach is genuinely
different. Most journaling apps are native and require sync. Today Little
Log is instant. **But:** "instant" and "offline" aren't compelling enough
alone. The app needs a unique hook. **Mitigation:** The scoreboard +
streak system is the hook. It's not a journal — it's a game for your life.
Lead with that.

### tinygpt (Local LLM Factory)
**Positioning:** Run LLMs locally on your Mac with one command.
**Audience:** ML engineers, privacy-conscious devs, local-LLM enthusiasts.
**Channel:** r/LocalLLaMA, HN, ML Twitter.
**Demo:** "brew install tinygpt && tinygpt chat --model qwen3-4b" —
streaming output, 20 tokens/s on M2.
**Why now:** The KV cache reuse fix (planned) makes multi-turn 20-50X
faster. The WebGPU playground is a separate browser-based demo.
**Devil's advocate:** Ollama already does this and has 100k+ users. LM
Studio has a polished GUI. Why would someone use tinygpt? **Counter:**
tinygpt is a factory, not just a runner — it trains, fine-tunes, and
evaluates models. The eval harness (BFCL, lm-eval) is unique. **But:**
the audience for local model training is tiny compared to the audience
for local inference. **Mitigation:** Split the marketing: "tinygpt chat"
for inference (compete with Ollama on speed), "tinygpt eval" for
evaluation (unique), "tinygpt train" for fine-tuning (advanced). Don't
try to be everything at once.

---

## Tier 3 — Needs Product Work First

### ai-game (3D AI World Simulator)
**Positioning:** TBD — is it a game? A simulation? A demo of AI agents?
**Devil's advocate:** The product doesn't know what it is yet. "AI NPCs
with memory" is interesting but what's the user's reason to return? The
perf issues (JSON cloning, unbatched embeddings) mean it's slow at scale.
**Recommendation:** Don't market until the core loop is fast AND the value
proposition is clear. The "AI NPCs that remember you" angle is genuinely
novel — but it needs a game wrapper that gives players a reason to
interact with the NPCs.

### open-historia (AI Grand Strategy)
**Positioning:** AI-generated history — play any era, watch civilizations
rise and fall.
**Devil's advocate:** Grand strategy is Paradox's territory (Europa
Universalis, Crusader Kings). They have 20 years of polish and a fanatical
audience. An AI-generated competitor can't match the depth. **Counter:**
The AI angle is different — it's not a scripted game, it's an emergent
simulation. No two playthroughs are the same. **But:** emergent doesn't
mean fun. The AI needs to produce interesting narratives, not just
plausible ones. **Recommendation:** Don't market until the map is smooth
(perf fix) and the AI turn generation is under 2 seconds. Target
r/paradoxplaza and r/4Xgaming with "AI generates the history, you shape
it."

### email-manager (Gmail Workspace)
**Positioning:** Search your inbox by meaning, not keywords.
**Devil's advocate:** Gmail is deeply personal. Trust is everything. A
new email client requires users to grant OAuth access to their entire
inbox. That's a high trust barrier. And the local semantic search is
cool but — if the first sync takes 5 minutes, users will bail. **Counter:**
The incremental sync fix (planned) addresses the speed issue. And local
processing is a trust feature, not a trust problem — "your emails never
leave your device" is compelling. **But:** the audience that cares about
local processing is small (power users, privacy advocates). Most people
just use Gmail's search. **Recommendation:** Fix sync speed, then market
to r/productivity and privacy communities. The "search by meaning" angle
is the hook.

### drank (DR Tracker)
**Positioning:** Track your Domain Rating for free, client-side, no signup.
**Devil's advocate:** SEO practitioners already pay for Ahrefs ($99+/mo).
A free client-side tracker is a nice tool but not a business. And the
audience is small (SEO professionals). **Counter:** It's a lead gen tool
for other fleet products, not a standalone business. **But:** even as
lead gen, it needs to be fast and reliable. The batched domain refresh
fix (planned) is critical — if tracking 50 domains takes 37 seconds,
that's a bad demo. **Recommendation:** Fix the domain refresh, then post
on SEO communities. Keep it free. Use it to drive traffic to other
products.

### materia (Evidence-Graded Supplements)
**Positioning:** What supplements actually work, graded by evidence,
organized by body part.
**Devil's advocate:** Health information is a legal and ethical minefield.
If the evidence grading is wrong, someone could take a harmful supplement.
And the 3D body interface is cool but — is it a reference tool or a
shopping tool? **Counter:** The evidence grading (A/B/C/I) is sourced
from published studies. It's reference, not recommendation. **But:**
the 207-remedy dataset is small. Users will notice gaps. **Recommendation:**
Expand the database before marketing. Target r/Nootropics and
r/Supplements with "evidence-graded, not marketing-graded." The 3D body
interface is the visual hook for social media.

### looptv (Random Video TV)
**Positioning:** Endless random videos, TV-style, zero friction.
**Devil's advocate:** This is a toy, not a product. What's the retention
mechanism? Why would someone return? **Counter:** It's a lean-back
experience — the TV metaphor is the retention. You don't "return" to TV;
you just turn it on. **But:** monetization is unclear. Pre-roll ads kill
the vibe. Subscription doesn't make sense for random videos.
**Recommendation:** Fix the catalog cache headers (perf PR), then market
on r/InternetIsBeautiful as a curiosity. If it gets traffic, consider it
a portfolio piece. Don't invest in monetization until retention data
justifies it.

### taste (ShipRank)
**Positioning:** Rank your screenshots before you A/B test, not after.
**Audience:** Product teams, designers, PMs.
**Devil's advocate:** "Pre-A/B ranking" is a niche of a niche. Most teams
skip straight to A/B testing. Why rank before testing? **Counter:** A/B
testing is expensive (traffic, time). Pre-ranking narrows the field from
10 variants to 3, saving 70% of A/B traffic. **But:** the arena
(1v1 voting) needs participants. Who votes? **Recommendation:** Fix the
indexes (perf PR), then market to PM communities. The "save 70% of A/B
traffic" angle is the pitch. The arena voting is the viral hook —
"help rank startup landing pages" could attract a community.

### significanthobbies (Hobby Discovery)
**Positioning:** Find hobbies that actually matter to you, track your
journey.
**Devil's advocate:** Hobby discovery is a nice idea but the monetization
is unclear. And "find your hobby" is a one-time use case — you don't
return after you've found a hobby. **Counter:** The journaling + timeline
is the retention mechanism. You don't just discover — you track your
progress. **But:** the explore page (marketing surface) was doing 100
sequential COUNT queries — the perf PR fixes this. **Recommendation:**
Market after the perf PR merges. Target r/GetStudying and
r/productivity. The "significant" framing (not just hobbies, but
meaningful ones) is the differentiator.

---

## Tier 4 — Not Ready to Market

### forecast-lab
**Why not:** Research tool without a clear audience. ML engineers use
established eval frameworks (lm-eval, HELM). The perf fixes (HashSet,
HashMap) make it faster but don't make it a product.
**When:** Define the audience (forecasting engineers? recsys teams?) and
the value prop ("eval-first means you benchmark before you ship"). Then
market on ML Twitter.

### reel-pipeline
**Why not:** Internal tool for generating marketing videos for other fleet
products. Not a standalone product.
**When:** Never market externally. Optimize for internal throughput (the
perf PRs do this).

### verified-bases
**Why not:** The catalog needs real, high-quality bases. An empty
marketplace is worse than no marketplace.
**When:** Populate 10-20 verified bases, then market on indie hacker
communities. The "verified" angle is the differentiator.

### pace
**Why not:** The hardcoded sleeps (350ms, 600ms) make the agent feel
sluggish. A voice agent that feels slow is dead on arrival.
**When:** Fix the latency issues (perf PRs), then record a YouTube demo.
The story — "your Mac has a voice assistant that can see your screen" —
is a killer demo if it feels instant.

### knowledge-base
**Why not:** Infrastructure for other fleet products, not a standalone
product.
**When:** Never market externally. Fix perf for internal use.

---

## Fleet-Wide Marketing Strategy

### The "Fleet" Story
The meta-narrative: "28 products, one team, built on shared infrastructure."
This is itself a marketing angle — it demonstrates engineering velocity and
the power of the Foundry (saas-maker). Use the fleet as proof that the
Foundry works.

### Cross-Promotion
- free-ai powers the AI in rolepatch, codevetter, high-signal, karte →
  "Powered by free-ai" badge on each
- saas-maker powers the billing/auth in truehire, taste, significanthobbies
  → "Built with The Foundry" badge
- research-papers feeds reader → "Import from research-papers" button in
  reader
- tinygpt powers local AI in pace → "Local AI by tinygpt"

### Content Marketing
- "How we made semantic search 100X faster" (research-papers vector index)
- "Why N+1 queries are killing your Next.js app" (significanthobbies fix)
- "Streaming AI responses: the 30-second perf win" (rolepatch, codevetter)
- "Building 28 products with one toolkit" (saas-maker story)

### Launch Order
1. **free-ai** — lowest barrier, instant value, dev audience
2. **rolepatch** — clear pain point, streaming demo is compelling
3. **codevetter** — privacy angle, streaming demo
4. **high-signal** — daily habit, instant load
5. **karte** — viral "roast" mode
6. **saas-maker** — the meta-story (use the above as proof points)
7. Everything else as fixes land
