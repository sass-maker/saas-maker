import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, "../src/content/docs");
const outputPath = join(__dirname, "../public/llms.txt");

const FILE_ORDER = [
  "getting-started/introduction.md",
  "getting-started/quickstart.md",
  "getting-started/authentication.md",
  "api/overview.md",
  "services/feedback.md",
  "services/waitlist.md",
  "services/testimonials.md",
  "services/forms.md",
  "services/changelog.md",
  "services/knowledge-base.md",
  "services/analytics.md",
  "sdk/javascript.md",
  "sdk/cli.md",
  "widgets/feedback.md",
  "widgets/testimonials.md",
  "widgets/changelog.md",
  "widgets/survey.md",
];

const HEADER =
  "# SaaS Maker API Documentation\n\n> Drop-in backend services for SaaS apps. Base URL: https://api.sassmaker.com\n\n";

function stripFrontmatter(content) {
  // Remove YAML frontmatter delimited by --- at start of file
  return content.replace(/^---[\s\S]*?---\n?/, "").trimStart();
}

const sections = FILE_ORDER.map((relativePath) => {
  const fullPath = join(docsRoot, relativePath);
  const raw = readFileSync(fullPath, "utf-8");
  return stripFrontmatter(raw);
});

const output = HEADER + sections.join("\n---\n\n");

writeFileSync(outputPath, output, "utf-8");
console.log(`Generated ${outputPath}`);
