# content-studio

## ADDED Requirements

### Requirement: Studio tools run at zero cost without credentials
Every studio tool SHALL produce usable output with no API keys configured, via
deterministic template generation. When a DeepSeek-compatible LLM env is
present (`DEEPSEEK_API_KEY`, optional base URL/model), tools SHALL use the LLM
and fall back to templates on request failure.

#### Scenario: No API key configured
- **WHEN** a studio tool runs and no LLM env is configured
- **THEN** it returns deterministic template-based output and marks the result `source: "template"`

#### Scenario: LLM configured
- **WHEN** `DEEPSEEK_API_KEY` is set and the request succeeds
- **THEN** the tool returns LLM output marked `source: "llm"`

### Requirement: Video idea generation
The studio SHALL generate video ideas for a niche/topic, each with a working
title, angle, hook line, and format tag; and SHALL support niche exploration
(sub-niche suggestions) and channel name suggestions.

#### Scenario: Ideas for a niche
- **WHEN** the user requests ideas for a niche with a count N
- **THEN** the studio returns N distinct ideas each containing title, angle, hook, and format

### Requirement: Metadata generation
The studio SHALL generate video titles (multiple variants), descriptions
(with hook line, summary, chapters placeholder, CTA, hashtag block), tags
bounded to YouTube's 500-char limit, and organize an existing tag list by
deduplicating and ranking by length-fit.

#### Scenario: Title variants
- **WHEN** the user requests titles for a topic
- **THEN** at least 5 distinct title variants under 100 characters are returned

#### Scenario: Tags respect platform limit
- **WHEN** tags are generated or organized
- **THEN** the joined tag list length is ≤ 500 characters and contains no duplicates

### Requirement: Script generation
The studio SHALL generate scripts for a target duration between 30 seconds and
20 minutes, scaling word count to duration (~150 wpm), structured as scenes
with narration and b-roll queries, using a single narration voice by default.
It SHALL accept an optional brand-voice profile and an optional inspiration
transcript, and SHALL convert a provided article text into a script.

#### Scenario: Duration scaling
- **WHEN** the user requests a 10-minute script
- **THEN** the script's total narration word count is within ±20% of 1500 words

#### Scenario: Article to script
- **WHEN** the user supplies article text
- **THEN** the studio returns a scene-structured script derived from the article's key points

### Requirement: Brand voice profile
The studio SHALL derive a brand-voice profile (tone descriptors, pacing,
vocabulary hints, catchphrases) from one or more sample transcripts, and
script generation SHALL accept that profile to shape output.

#### Scenario: Profile from transcripts
- **WHEN** the user supplies sample transcripts
- **THEN** the studio returns a JSON voice profile usable by the script generator

### Requirement: Keyword research
The studio SHALL return keyword suggestions for a seed term using free public
suggest endpoints (no API key), including the seed's autocomplete expansions
and question-style variants.

#### Scenario: Suggest expansion
- **WHEN** the user researches a seed keyword and the suggest endpoint is reachable
- **THEN** the studio returns a ranked list of suggestion strings

#### Scenario: Offline fallback
- **WHEN** the suggest endpoint is unreachable
- **THEN** the studio returns template-based keyword variants instead of failing

### Requirement: Transcript tooling
The studio SHALL fetch publicly available YouTube captions for a video URL and
return a cleaned, paragraph-formatted transcript; when captions are
unavailable it SHALL report that clearly rather than fail.

#### Scenario: Public captions exist
- **WHEN** the user supplies a YouTube URL whose video has public captions
- **THEN** the studio returns a formatted transcript with timestamps stripped

### Requirement: Thumbnail concepts
The studio SHALL generate thumbnail concepts (composition, text overlay ≤ 4
words, emotion, color scheme) and SHALL optionally render a concept to an HTML
preview artifact using the existing html-composition path.

#### Scenario: Concept generation
- **WHEN** the user requests thumbnail concepts for a topic
- **THEN** at least 3 concepts are returned each with overlay text of 4 words or fewer

### Requirement: Ideas manager persistence
The studio SHALL persist saved ideas/drafts to a JSON file store with list,
save, and update-status operations (`new`, `scripted`, `rendered`, `posted`).

#### Scenario: Save and list
- **WHEN** an idea is saved and the list operation runs
- **THEN** the saved idea appears with its status and timestamps
