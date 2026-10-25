# Third-party brand search and AI visibility study

Reviewed 25 October 2026. This is a desk study of current provider documentation
and public platform samples, plus an executable measurement design. It is not a
completed publication/indexing trial or a prediction of 2027 rankings. No profiles,
posts, purchases or indexing submissions were made for this study.

## Findings and decisions

| Claim or tactic | Finding | Operational decision |
| --- | --- | --- |
| These hosts index profiles within 24 hours | No platform-wide or engine-backed guarantee established; no new URLs were followed for 24 hours in this study | Record actual first-observed inclusion at 24h, 7d and 30d; retain unavailable observations |
| Use an indexing service | Valid notifications can help discovery; supported engines, host rights and mechanisms differ | Prefer existing native integration, then authorized Search Console/sitemap or eligible IndexNow; record receipt separately |
| Own more top-10/20 results to win citations | Plausible retrieval hypothesis, not a demonstrated universal threshold or causal rule | Capture organic slots and AI cited URLs independently on a frozen panel |
| Post identical promotional pages across hosts | Little audience value; duplication may consolidate under one canonical | Use distinctive, substantiated, platform-native answers; count controlled content separately from independent coverage |
| Every public host is a distribution channel | Site builders provide publishing infrastructure; they do not automatically supply readers | Choose hosting for a real content purpose; select communities by audience fit |
| Publish on every platform | No evidence that all 24 add useful reach for each product | Start with the best-fit small pilot and stop weak channels based on observations |

The supplied list has 19 domains: numbering skips 16. Five additional distinct
platforms in the follow-up list make 24 assessed candidates. No omitted hostname
was invented. Recommendations below are editorial judgments for a software/product
portfolio; they are not measured channel conversion rankings.

## Search-engine and indexing evidence

Google says managed URLs can be submitted through Search Console inspection or a
sitemap, but crawling may take days or weeks and inclusion is not guaranteed.
Repeated requests do not speed it up. An API reporting inspection status is not a
request-indexing API. [Google recrawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

The Google Indexing API is restricted to JobPosting or BroadcastEvent embedded in
VideoObject pages. A successful response concerns notification, not a general
product/profile indexing entitlement. Do not add false structured data to qualify.
[Indexing API](https://developers.google.com/search/apis/indexing-api/v3/using-api)

IndexNow requires proof of host control through a public key file, unless the
publishing platform handles its native integration. A social account generally
cannot place that file for the platform host. HTTP success is receipt evidence,
not index evidence. The current participating-endpoint list does not include
Google. [Protocol](https://www.indexnow.org/documentation),
[FAQ and supported endpoints](https://www.indexnow.org/faq)

A paid vendor's submission SLA, crawl claims or refund terms are not a search
engine indexing/ranking guarantee. No vendor was selected, paid or independently
qualified in this study. For eligible managed sites, the free provider workflows
above are the first service choice. For third-party profiles, verify the host's
supported discovery mechanisms rather than submit through an unverified workaround.

Google describes query fan-out and supporting links for AI Overviews/AI Mode.
Technical eligibility includes indexing and snippet eligibility; meeting it does
not guarantee inclusion. Neither document defines a universal top-20 citation
threshold, and these rules do not establish the behavior of other LLM products.
[AI features](https://developers.google.com/search/docs/appearance/ai-features),
[AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

Google distinguishes useful editorial/UGC activity from scaled low-value content
and content placed mainly to exploit host reputation. This does not mean every
brand profile or community post violates policy. Duplicate content can be
canonicalized rather than receive separate search visibility. These are reasons
to prioritize useful distinct contributions, not evidence that syndication always
fails. [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies),
[Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)

A 2026 PMLR observational study of Google AI Overviews on YMYL/MS MARCO queries
models retrieval, rank, provenance and citation separately. It reports citation
patterns beyond retrieval rank, including citations to documents not in its
retrieved set. That is a useful measurement model, not causal evidence that mass
profiles cause citations, and not a general finding across all engines or markets.
[PMLR paper](https://proceedings.mlr.press/v318/kakimov26a.html)

## Platform comparison

| Platform | What it is and indexability | Audience/editorial fit | Decision |
|---|---|---|---|
| [Bluesky](https://bsky.app/) | Open-protocol social network; account handles can be tied to a domain, and logged-out users can search posts. External search inclusion remains per-page/search-engine dependent. [Official handle guide](https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial), [search guide](https://bsky.social/about/blog/05-31-2024-search) | Tech, creator, and public-conversation communities. A founder voice with concise product lessons or build notes fits better than a stream of product links. | **Experiment** with a month of useful discussion if the owner is willing to participate; not an SEO-only channel. |
| [Instagram](https://www.instagram.com/) | Visual social network. The official indexing-controls help URL was located, but its body returned HTTP 429 in this review; precise professional-account/content eligibility requires confirmation before a live pilot. Public accessibility alone does not prove indexing. [Official indexing eligibility and controls](https://help.instagram.com/147542625391305/) | Strong for visual products, process clips, design, and short demonstrations; weak for text-only product announcements. | **Experiment** only for products that can show their value visually; use a public professional profile and original captioned media. Measure actual search/referral outcomes rather than assuming indexing. |
| [Mastodon](https://mastodon.social/) | Federated social network. Each server is a separate community; public posts may be visible, but profile/post indexing is configurable and instance-dependent. [Official profile settings](https://docs.joinmastodon.org/user/profile/), [privacy/indexing preferences](https://docs.joinmastodon.org/user/preferences/), [post visibility](https://docs.joinmastodon.org/user/posting/) | Communities are server-specific. Best for sustained technical/open-source or topic participation after identifying a relevant instance. | **Hold** absent a known relevant community or existing audience; do not assume the mastodon.social root represents the whole network. |
| [Pinterest](https://www.pinterest.com/) | Visual search/discovery and shopping platform; public profiles/boards may appear in external search, while the privacy setting adds an exclusion signal. [Pinterest search privacy](https://help.pinterest.com/en/article/update-your-search-privacy), [product Pins](https://help.pinterest.com/en/business/guide/shopping-on-pinterest) | Evergreen diagrams, image-led tutorials, recipes/style/design, and product imagery. Most SaaS products have weak fit without genuinely useful visual assets. | **Conditional experiment** for image-first products/tutorials; otherwise hold. |
| [Threads](https://www.threads.com/) | Public text/social discussion, with optional ActivityPub sharing for eligible public profiles. Fediverse discoverability is opt-in and varies by feature/region; external web indexing is not guaranteed. [Meta fediverse guide](https://about.fb.com/news/2024/06/what-is-the-fediverse/), [current fediverse search/feed feature](https://about.fb.com/news/2025/06/its-now-easier-see-more-fediverse-content-threads/) | Creator/business conversation and short observations; can extend reach into federated communities when sharing is enabled. | **Experiment** if already using Instagram/Meta; test original, conversational posts, not repost-only promotion. |
| [X](https://x.com/) | Public posts are visible off-platform; X says public profile/post words may be indexed by external search, but protected posts are not. X search filters accounts/posts and favors complete profiles and activity. [External-search visibility](https://help.x.com/en/safety-and-security/remove-x-profile-from-google-search), [X account search](https://help.x.com/en/using-x/x-search-not-working) | Fast-moving tech, news, creator, and professional conversation; requires regular presence and tolerance for noise. | **Conditional experiment** for timely expert commentary; low priority if the owner does not already engage there. |
| [Tumblr](https://www.tumblr.com/) | Microblogging/community. Tumblr documents in-platform tag search and external-search controls; new accounts ramp visibility gradually, and mature/hidden blogs are excluded. [Search visibility](https://help.tumblr.com/knowledge-base/appearing-in-search-results/), [community and discovery guidance](https://help.tumblr.com/knowledge-base/getting-more-traffic-and-engagement/) | Stronger for art, fandom, visual experiments, and niche culture than for general SaaS. Original tagged posts are important for tag search. | **Hold** unless a product has a creative/cultural audience and can contribute original work. |
| [Carrd](https://carrd.co/) | One-page site builder, not a publishing community. Custom meta tags require Pro Standard or higher. [Official meta-tag docs](https://carrd.com/docs/sites/setting-up-meta-tags) | Suitable for a compact campaign or personal landing page; no native audience to distribute content. | **Hold** as a distribution channel; use only when a one-page destination solves a real campaign need. |
| [Google Sites](https://sites.google.com/) | Hosted site builder. Public sites can be discovered; owners can request exclusion, but Google says this request is not a guarantee. [Publish/share/indexing controls](https://support.google.com/sites/answer/6372880/publish-amp-share-your-site) | Useful for simple documentation or an information hub, not native audience acquisition. | **Hold** for brand distribution; publish useful reference content on the canonical site instead. |
| [Lovable](https://lovable.app/) | AI app/site builder and publishing host, not an audience network. The supplied `lovable.app` is the published-app host; Lovable's docs say published projects use a customizable `[url-subdomain].lovable.app` address by default. It offers SEO checks; custom domains are available on paid plans. [Publishing and URL pattern](https://docs.lovable.dev/features/publish), [custom-domain docs](https://docs.lovable.dev/features/custom-domain) | Useful for a product prototype or interactive proof. The app itself must earn traffic; the platform is not a source of followers. | **Hold** for distribution; use only if an interactive prototype is the content asset. |
| [SITE123](https://www.site123.com/) | Website builder brand/service root; the supplied `site123.me` is a hosted-tenant hostname (for example, `name.site123.me`), not the SITE123 homepage. SITE123 says free sites receive a generated subdomain; its root service page is `.com`. Page metadata and SEO controls do not make this a native audience network. [Official free-subdomain/pricing details](https://www.site123.com/pricing), [example tenant host](https://route.site123.me/) | Good enough for a simple site, with no meaningful native editorial audience. | **Hold**; treat `.site123.me` as hosting infrastructure, not a distinct distribution channel. |
| [Strikingly](https://www.strikingly.com/) (`mystrikingly.com` hosted URLs) | Website builder brand/service root; the supplied `mystrikingly.com` is Strikingly's hosted-site domain. Its help center describes free tenant URLs in that domain; title/description SEO settings and search-visibility controls are available. [Official hosted URL guide](https://support.strikingly.com/hc/en-us/articles/215046287-Strikingly-Free-URL-Changing-MyStrikingly-com-URL), [SEO overview](https://www.strikingly.com/website-seo) | Single-page/business sites; no independent audience benefit demonstrated by its product docs. | **Hold** for distribution; treat the supplied host as tenant hosting, not a separate network. |
| [Webflow](https://webflow.io/) | Website/CMS builder with metadata, XML sitemap and redirects; page-level noindex is configurable. [SEO features](https://webflow.com/feature/seo), [noindex controls](https://webflow.com/updates/noindex-improvements) | Best fit here for a designed, content-rich owned microsite, but still requires an audience and original content. | **Hold** as a separate channel; prefer the canonical product site unless Webflow provides a concrete workflow advantage. |
| [Weebly](https://www.weebly.com/) | Website builder with page titles, descriptions, URLs and search visibility controls. [SEO features](https://www.weebly.com/websites/seo), [support docs](https://www.weebly.com/app/help/us/en/topics/descriptions-and-keywords) | Small-business websites/blogs; does not provide a distinct distribution audience. | **Hold** for distribution. |
| [Wix](https://www.wix.com/) (wixsite.com hosted URLs) | Hosted site builder; Wix says its sites can be crawled by search engines and AI bots, and offers sitemap/meta/SEO tools. A free Wix URL may be indexed; domain changes take time to recrawl. [SEO guidance](https://support.wix.com/en/article/search-engine-optimization-seo), [free URL/indexing](https://support.wix.com/en/article/your-free-wix-url-appearing-in-search-engine-results-after-upgrading) | Can support a full site, but a wixsite.com profile/site is still owned content, not platform reach. | **Hold** as a channel; use only if already the chosen publishing stack. |
| [AmpedPages](https://ampedpages.com/) | Current homepage describes a free website/blog builder, responsive templates and “Google friendly” hosting. One tenant page appeared in search; this small sample says nothing reliable about platform-wide content quality or indexing behavior. [Homepage](https://ampedpages.com/), [sample tenant page](https://nohitchmedia.ampedpages.com/) | No well-evidenced audience or editorial standard located in this pass. | **Hold** for lack of demonstrated qualified audience; do not treat “Google friendly” marketing copy or one tenant page as an indexing or trust signal. |
| [Blog5](https://blog5.net/) | Current homepage describes a combined websites/e-commerce/marketing tool; signup is available. A few search-visible tenant examples included suspended or SEO/backlink-themed pages; these observations are nonrepresentative and do not establish platform-wide prevalence or safety. [Homepage](https://blog5.net/), [signup](https://blog5.net/signup), [sample tenant pages](https://fillipa.blog5.net/), [sample tenant page](https://craigkobv388507.blog5.net/) | No strong editorial fit or audience evidence located for a brand profile. | **Hold** pending evidence of a relevant audience and useful distribution; do not generalize from sampled tenant pages. |
| [BlogDigy](https://blogdigy.com/) | Current homepage markets a free hosted blog, with signup and examples. A few search-visible tenant examples included suspended or unrelated SEO/backlink/affiliate-style posts; these observations are nonrepresentative and do not establish platform-wide prevalence or safety. [Homepage](https://blogdigy.com/), [signup/login](https://blogdigy.com/login), [sample tenant pages](https://baji66online.blogdigy.com/), [sample tenant page](https://blogcomment608715.blogdigy.com/boost-your-website-with-engaging-blog-comments-67649916) | No established audience or editorial quality signal located in this pass. | **Hold**; a crawlable tenant page is not evidence of useful distribution, and the sample is not a platform-wide verdict. |
| [Blogocial](https://blogocial.com/) | Current homepage markets a free website/blog builder and signup offers social login. A few public tenant examples included suspended or unrelated keyword-led pages; these observations are nonrepresentative and do not establish platform-wide prevalence or safety. [Homepage](https://blogocial.com/), [signup](https://blogocial.com/signup), [sample tenant pages](https://ko66vc1.blogocial.com/), [sample tenant page](https://luisreview.blogocial.com/) | No demonstrated curated audience located in this pass. | **Hold** for lack of demonstrated qualified audience; avoid treating root-page crawlability or isolated tenant indexing as external authority. |
| [Reddit](https://www.reddit.com/) | Community/discussion network. Public community posts can be read without the account in many cases, but discoverability and policies are community-specific. Reddit explicitly prohibits mass/repetitive promotion; its 9:1 self-promotion ratio is a rule of thumb, not a safe-harbor. [Spam policy](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam), [Reddiquette](https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette) | High-intent questions, troubleshooting and informed critique; strongest when answering a real question in the right subreddit. | **Priority experiment**, but answer-first, disclose affiliation, follow subreddit rules, and share links only when they materially help. |
| [Facebook](https://www.facebook.com/) | Social profiles, Pages and groups. External linking is a user privacy setting for profiles; public material may be indexed, but Meta notes it does not control search engines’ existing indexes. [Search-engine profile setting](https://www.facebook.com/help/411239642246274/) | Local/community organizations and broad consumer audiences; less compelling for an umbrella software brand unless a specific product has a relevant group or page audience. | **Hold** unless an existing audience or local/community use case is visible. |
| [YouTube](https://www.youtube.com/) | Public videos may appear in YouTube search/recommendations; ranking uses relevance, engagement and quality. New/changed videos may take days to appear. [Search ranking](https://support.google.com/youtube/answer/16090438?hl=en), [privacy and search visibility](https://support.google.com/youtube/answer/157177?hl=en), [search troubleshooting](https://support.google.com/youtube/answer/58097/find-your-channel-or-video-in-search-results/) | Product demos, walkthroughs and topic explainers can satisfy video-search intent and build a durable proof asset. | **Highest-priority experiment** if the owner can make one genuinely useful demo/explainer. Measure YouTube search impressions, retention and qualified referrals, not raw views alone. |
| [Hashnode](https://hashnode.com/) | Developer-focused blogging platform. Current Pro documentation places new custom domains, API access and GitHub backup behind Pro, with some grandfathered setups; verify the chosen account before automation. [Current Pro release](https://hashnode.com/changelog/2026-06-11-introducing-hashnode-pro) For republished articles, its editor lets the author set the original URL as canonical; a custom domain is another publishing option. [SEO settings](https://docs.hashnode.com/blogs/blog-dashboard/seo), [original canonical instructions](https://docs.hashnode.com/blogs/editor/writing-a-blog-post) (official search excerpt available; direct URL returned 404, so recheck current editor), [custom domain](https://docs.hashnode.com/help-center/blog-domain/how-to-map-a-custom-domain), [Code of Conduct](https://hashnode.com/code-of-conduct) | Strong, narrow fit for original engineering notes, implementation lessons, APIs, open-source tools and technical product explainers. It prohibits bulk posting and SEO abuse. | **Priority experiment** for genuinely technical work; publish one substantive, developer-useful article and track engagement/referrals. |
| [Medium](https://medium.com/) | Publishing platform with public profiles/stories and its own recommendation/distribution surfaces. Medium's import tool adds the original source as a canonical URL; authors can also set a canonical link manually. Medium limits search indexing based on quality/trust thresholds and says eligibility can take days to weeks; search listing is not guaranteed. [Story distribution](https://help.medium.com/hc/en-us/articles/360018677974-What-happens-to-your-story-when-you-publish-on-Medium), [SEO/indexing guidance](https://help.medium.com/hc/en-us/articles/217991468-About-SEO-and-Medium), [import with automatic canonical](https://help.medium.com/hc/en-us/articles/214550207-Importing-a-post-to-Medium), [manual canonical control](https://help.medium.com/hc/en-us/articles/360033930293-Set-a-canonical-link), [publication submissions](https://help.medium.com/hc/en-us/articles/213904978-How-to-submit-a-story-to-a-publication) | Best for thoughtful essays, lessons and product/problem analysis for a broad writing audience; publication placement is editorial and not automatic. | **Priority experiment** for one original founder essay with a clear problem/lesson; do not dump product announcements. |


Research access limits: the comparison combines retrieved official documentation,
official search excerpts and small public tenant samples. Instagram help was rate
limited; the older Hashnode editor URL returned 404 directly while its official
search excerpt remained available. These are explicit rechecks before execution,
not successful account qualification. No platform-wide crawl audit was performed.

Recommended starting formats are a useful YouTube demonstration, a relevant
Reddit answer where allowed, and Hashnode for a developer tutorial or Medium for a
broader product essay. Instagram/Pinterest require a strong visual use case;
Bluesky/Threads/X need genuine conversation and audience fit. Builder hosts and the
four obscure blog hosts remain holds absent a concrete audience/content advantage.
These priorities are estimates; no channel earned a measured growth score here.

## First experiment and weekly decision

Use the selected public product and existing authorized accounts. If the pilot is
Motion, describe the unreleased prototype accurately: a landing or debug demo does
not establish physical-device control feel. Keep private tools exempt from public
acquisition. No campaign is launched by finishing this desk study.

1. Freeze 12 real long-tail questions across problem, workflow and comparison
   intents, plus 3 brand lookup questions. Record market, language, device, engine
   and date. Capture baseline organic results and available AI answer surfaces;
   retain unavailable captures rather than substituting a different surface.
2. Choose at most three formats according to product fit: a useful demonstration,
   one technical/problem-solving article, and a relevant community contribution.
   Prefer an existing authentic profile to another empty account. Give each asset
   a distinct useful purpose and a canonical destination with appropriate source
   attribution. Record disclosure and account identity in private campaign state.
3. Verify public URLs, status, visible text/media, canonical/noindex controls and
   useful handoff. Use an eligible existing indexing service/workflow; capture its
   notification receipt. Where no supported submission route exists, record that
   limit and observe natural discovery. No access controls or quotas are bypassed.
4. Observe at 24h, 7d and 30d. Compare a fixed query/prompt panel; include comparable
   untouched queries when feasible. Do not switch cohorts to chase good numbers.
   One pilot and small samples support directional evidence, not causal proof.
5. Weekly: inspect measurement health, choose one content/indexing/handoff fix,
   retain prior observations and a follow-up date. Continue channels with useful
   audience response, improve weak handoffs, and stop channels lacking relevant
   readers after the stated window. Never interpret missing data as verified zero.

Minimum retained fields in the existing product issue/evidence record:

| Area | Fields |
| --- | --- |
| Artifact | Product ID, lifecycle, platform/account reference, authored-by-brand vs independent, exact public URL, intent, publishedAt UTC, content revision |
| Execution | Public access/canonical/indexability checks, method/service, submittedAt UTC, receipt/status, blockers; no tokens |
| Indexing | Engine, checkedAt UTC, status (indexed/confirmed-excluded/not-observed/inaccessible/not-checked), selected canonical if known, firstObservedAt UTC, evidence location |
| Organic slots | Frozen query ID, engine, market/language/device, observed eligible slots, position, unique controlled URL, first10/20 separately, branded vs neutral |
| AI outcomes | Prompt/version, engine/model/surface, checkedAt UTC, answer capture, mention, actual cited URL, controlled vs independent source, factual accuracy, recommendation |
| Useful use | Window, non-QA referred sessions/people with identity limits, meaningful completed action, attribution coverage; visits and conversions separate |
| Decision | Baseline comparison, limitations/concurrent changes, keep/improve/stop, next lever, responsible owner, next review |

The 24-hour first-observed index rate uses only eligible new URLs with a completed
24-hour observation, and reports missing checks separately. First-observed time is
an upper bound; the exact indexing event time is usually unavailable. A negative
site: query is not definitive exclusion. Google Search Console access to an owned
site does not provide URL inspection for every external profile.

For each query, top-20 presence is unique brand-controlled organic result URLs
among observed eligible slots (report raw count and actual denominator). Record
unique domains too; do not count AI cards or ads as organic slots. AI citation rate
uses captured answers with actual cited URLs, with failed/no-answer observations
reported separately. Preserve brand-authored and independent citation counts.

No result points are awarded solely for completing profiles, publishing, submitting
URLs, adding markup or waiting. Update the existing SEO and GEO Effort/Result
records with dated evidence. This work does not create a seventh scoring category.
