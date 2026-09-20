import launchSpreadsheetMarkdown from './articles/a-structured-alternative-to-a-product-launch-spreadsheet.md?raw';
import dataQualityChecksMarkdown from './articles/data-quality-checks-for-a-launch-directory-catalog.md?raw';
import freeVsPaidDirectoriesMarkdown from './articles/free-vs-paid-product-directories-how-to-decide.md?raw';
import realSubmissionRoutesMarkdown from './articles/how-to-identify-real-submission-routes-in-launch-directories.md?raw';
import followUpDatesMarkdown from './articles/how-to-plan-follow-up-dates-after-a-product-submission.md?raw';
import csvJsonCampaignMarkdown from './articles/importing-and-exporting-a-launch-campaign-with-csv-and-json.md?raw';
import privateWorkspaceMarkdown from './articles/keeping-a-launch-workspace-private-in-browser-local-storage.md?raw';
import launchChannelMarkdown from './articles/matching-a-launch-channel-to-the-product-being-launched.md?raw';
import quarantineListingMarkdown from './articles/when-to-quarantine-a-dead-or-contradictory-launch-listing.md?raw';
import sourceAttributionMarkdown from './articles/why-every-launch-destination-needs-source-attribution.md?raw';
import submissionSpamMarkdown from './articles/why-launch-tracking-should-not-become-automated-submission-spam.md?raw';
import capabilitiesLearningMarkdown from './articles/skills-should-declare-capabilities-not-model-names.md?raw';

export const LEARNINGS = [
  {
    slug: 'a-structured-alternative-to-a-product-launch-spreadsheet',
    title: 'A structured alternative to a product-launch spreadsheet',
    description:
      'Learn how to replace your stale product-launch spreadsheet with a structured, verifiable JSON dataset. Explore a scalable architecture for tracking launch directories, PR metrics, and link status.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '7 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/a-structured-alternative-to-a-product-launch-spreadsheet',
    markdown: launchSpreadsheetMarkdown,
  },
  {
    slug: 'data-quality-checks-for-a-launch-directory-catalog',
    title: 'Data-Quality Checks for a Launch-Directory Catalog',
    description:
      'Discover a structural approach to catalog data quality. Learn how to separate private metadata from public directories and enforce strict schema checks without a traditional database.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '6 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/data-quality-checks-for-a-launch-directory-catalog',
    markdown: dataQualityChecksMarkdown,
  },
  {
    slug: 'free-vs-paid-product-directories-how-to-decide',
    title: 'Free vs paid product directories: how to decide',
    description:
      'An evidence-based guide on evaluating free versus paid product directories for SaaS discovery, based on real portfolio management and catalog curation strategies.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '6 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/free-vs-paid-product-directories-how-to-decide',
    markdown: freeVsPaidDirectoriesMarkdown,
  },
  {
    slug: 'how-to-identify-real-submission-routes-in-launch-directories',
    title: 'How to identify real submission routes in launch directories',
    description:
      'Stop wasting time on dead links and scraped lists. Learn how to identify verified submission routes for SaaS launch directories.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '7 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/how-to-identify-real-submission-routes-in-launch-directories',
    markdown: realSubmissionRoutesMarkdown,
  },
  {
    slug: 'how-to-plan-follow-up-dates-after-a-product-submission',
    title: 'How to plan follow-up dates after a product submission',
    description:
      'Learn how to establish actionable follow-up and verification plans after submitting a product to directories.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '7 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/how-to-plan-follow-up-dates-after-a-product-submission',
    markdown: followUpDatesMarkdown,
  },
  {
    slug: 'importing-and-exporting-a-launch-campaign-with-csv-and-json',
    title: 'Importing and exporting a launch campaign with CSV and JSON',
    description:
      'Learn how to manage your product launch campaign using standard formats like CSV and JSON, integrating structured data directly into your workflow.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '4 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/importing-and-exporting-a-launch-campaign-with-csv-and-json',
    markdown: csvJsonCampaignMarkdown,
  },
  {
    slug: 'keeping-a-launch-workspace-private-in-browser-local-storage',
    title: 'Keeping a launch workspace private in browser local storage',
    description:
      'Learn how to build a private, local-first launch workspace using browser local storage, with concrete examples from LaunchDesk.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '6 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/keeping-a-launch-workspace-private-in-browser-local-storage',
    markdown: privateWorkspaceMarkdown,
  },
  {
    slug: 'matching-a-launch-channel-to-the-product-being-launched',
    title: 'Matching a Launch Channel to the Product Being Launched',
    description:
      "Learn how to match your product's architecture, audience, and goals to the right launch channel using concrete examples.",
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '7 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/matching-a-launch-channel-to-the-product-being-launched',
    markdown: launchChannelMarkdown,
  },
  {
    slug: 'when-to-quarantine-a-dead-or-contradictory-launch-listing',
    title: 'When to Quarantine a Dead or Contradictory Launch Listing',
    description:
      'Learn how the quarantine pattern isolates suspect launch listings and conflicting metrics without silently erasing historical data.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '7 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/when-to-quarantine-a-dead-or-contradictory-launch-listing',
    markdown: quarantineListingMarkdown,
  },
  {
    slug: 'why-every-launch-destination-needs-source-attribution',
    title: 'Why every launch destination needs source attribution',
    description:
      'Discover why provenance-honest source attribution is critical for evaluating SaaS launch destinations, and why explicit unknowns beat invented metrics.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '6 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/why-every-launch-destination-needs-source-attribution',
    markdown: sourceAttributionMarkdown,
  },
  {
    slug: 'why-launch-tracking-should-not-become-automated-submission-spam',
    title: 'Why launch tracking should not become automated submission spam',
    description:
      'Discover why careful, manually tracked launch submissions using tools like LaunchDesk drastically outperform automated directory submission spam in SaaS.',
    publishedAt: '2026-09-20',
    publishedLabel: 'September 20, 2026',
    readingTime: '5 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/why-launch-tracking-should-not-become-automated-submission-spam',
    markdown: submissionSpamMarkdown,
  },
  {
    slug: 'skills-should-declare-capabilities-not-model-names',
    title: 'Skills should declare capabilities, not model names',
    description:
      'Why portable agent skills need provider-neutral intelligence and reasoning requirements, and how Fleet is testing the idea.',
    publishedAt: '2026-07-28',
    publishedLabel: 'July 28, 2026',
    readingTime: '7 min read',
    author: 'Sarthak Agrawal',
    href: '/learnings/skills-should-declare-capabilities-not-model-names',
    markdown: capabilitiesLearningMarkdown,
  },
] as const;
