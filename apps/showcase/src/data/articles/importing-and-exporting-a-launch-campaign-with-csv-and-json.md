# Importing and exporting a launch campaign with CSV and JSON

- Published: 2026-09-20
- Author: Sarthak Agrawal
- Reading time: 4 min read
- Canonical HTML: https://sassmaker.com/learnings/importing-and-exporting-a-launch-campaign-with-csv-and-json

## Introduction

Product launches require coordinating dozens of directory submissions, press outreach targets, and community announcements. While many teams default to a sprawling spreadsheet or a paid SaaS tool that locks their data into a proprietary dashboard, managing a launch campaign via standard, structured formats like CSV and JSON offers significant benefits. By owning your launch dataset, you gain the freedom to build custom filters, automate syncing across different internal tools, and integrate launch readiness checks directly into your CI/CD pipelines.

When launch data is treated as code, a dataset is not just a reference document—it can natively power your public-facing catalog or internal product-health dashboards. In this guide, we will explore the architecture of a launch campaign structured around CSV and JSON imports, using real-world schemas that enable lossless synchronization, validation, and curation.

## The JSON Model: A Lossless Launch Dataset

For developers and system automation, JSON provides a robust way to model launch data natively. An effective launch dataset in JSON does more than list URLs; it encapsulates domain authority, tracking flags, and categorized claims that dictate where a product can be launched and how successful that launch might be.

A mature JSON schema allows your team to map out each launch destination in granular detail. Let's examine a typical JSON structure that represents a launch directory entry:

```json
{
  "name": "AlternativeTo",
  "domain": "alternativeto.net",
  "website": "https://alternativeto.net/",
  "submissionUrl": "https://alternativeto.net/software/add/",
  "category": "Directory",
  "pricing": "free",
  "dr": 77,
  "link": "nofollow",
  "eligibility": "Product must have distinct features and fit into an existing or new alternative software category.",
  "flags": [],
  "route": "source-reported",
  "provider": "Ahrefs (source-reported)",
  "sourceUrl": "https://github.com/alvinunreal/awesome-submitlist/blob/main/data/destinations.json",
  "retrieved": "2026-09-18",
  "measured": null,
  "quarantined": false,
  "claims": [
    {
      "source": "submitlist",
      "dr": 77,
      "link": "nofollow",
      "pricing": "free"
    }
  ]
}
```

In this architecture, every launch destination is captured with precise attributes. The `dr` (Domain Rating) and `link` type (e.g., `nofollow` vs. `follow`) provide instant clarity on SEO value. The `category` and `pricing` fields enable quick filtering.

More importantly, notice the `claims` array and `quarantined` flag. Instead of blindly accepting data from an external source, a robust JSON dataset records *where* the claim came from (the `sourceUrl`) and allows you to quarantine entries that require further research or contain suspect source data. This prevents bad or unverified directories from automatically surfacing in your active launch queues.

## Working with CSV: A Bridge for Marketers and External Data

While JSON is perfect for runtime usage and automated pipelines, it is not always the best format for data entry, especially when collaborating with marketing team members who are comfortable in tools like Excel or Google Sheets. CSV remains the universal standard for moving tabular data between systems.

A successful launch workflow often involves ingesting raw CSV files sourced from public GitHub repositories or independent SEO research tools. For instance, you might download a CSV containing hundreds of potential directories.

The import process must translate this flat CSV structure into the rich JSON model shown above. When designing an import script, you should map CSV headers to your internal schema. For example, a CSV might have columns for `Name`, `Website`, and `Domain Authority`. The import script parses these, assigns a default `route` like `"needs-research"`, and flags any entries missing critical data.

By maintaining this separation—using CSV for broad ingestion and JSON for canonical storage—you enable marketers to source vast amounts of prospect data without compromising the structured integrity required by the presentation layer.

## Data Syncing: Establishing a Canonical Source of Truth

When dealing with imported data from various CSVs and compiled JSON files, establishing a clear source of truth is critical. A common pitfall is editing generated files directly.

Consider a scenario where your public-facing catalog or launch desk renders directly from a dataset like `apps/showcase/src/data/launchdesk.json`. If a team member hand-edits this JSON file to fix a typo or update a Domain Rating, those changes will be overwritten the next time the sync script runs.

To prevent this, the architecture should strictly separate the *source* dataset from the *generated* projection. In modern portfolio operations, the raw source data often lives in a private, local repository (or an independent checkout like a `launchdesk` repository) where it can be managed, reviewed, and validated.

When the launch data is ready for the presentation layer, an automated command—such as `pnpm sync:launchdesk`—pulls the verified source data, projects it into the required schema, and outputs the generated JSON file consumed by the application frontend. This one-way synchronization ensures that the public build uses only allowlisted, validated data and that all edits go through a structured review process in the canonical source.

## Practical Next Action

Now that you understand the relationship between CSV ingestion and JSON canonicalization for launch campaigns, you can start building custom views on top of your data.

Your practical next step: Build a simple HTML/JS filter against your generated JSON file. Create a view that filters out all `quarantined` entries and sorts the remaining directories by `dr` (Domain Rating). This small exercise will demonstrate the power of treating your launch campaign as a structured dataset, giving you a custom, high-priority launch list without relying on a paid subscription.
