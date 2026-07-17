# GitHub org profile READMEs

This directory contains profile READMEs for the 6 GitHub organizations in the
Foundry fleet. Each README describes what the org ships, links to product
domains, and links back to the fleet hub at https://sassmaker.com.

## How to deploy

GitHub org profile READMEs live in a special repository named after the org
itself (e.g., `Codevetter/Codevetter`) at `.github/profile/README.md`. GitHub
renders this README on the org's profile page.

To deploy each README:

1. Create a repo named exactly after the org (if it doesn't exist):
   - `Codevetter/Codevetter`
   - `HeyPace/HeyPace`
   - `PostTrainLLM/PostTrainLLM`
   - `High-Signal-App/High-Signal-App`
   - `Significant-Hobbies/Significant-Hobbies`
   - `sass-maker/sass-maker`
2. Copy the README from this directory into `.github/profile/README.md` in that repo:
   ```
   mkdir -p .github/profile
   cp docs/org-profiles/<org-name>/README.md .github/profile/README.md
   ```
3. Commit and push. The README will appear on the org's profile page.

## Files

```
docs/org-profiles/
├── Codevetter/README.md
├── HeyPace/README.md
├── PostTrainLLM/README.md
├── High-Signal-App/README.md
├── Significant-Hobbies/README.md
└── sass-maker/README.md
```

Each README is anchored to real product data from
`fleet-ops/config/agent-surfaces-registry.json` and links to the fleet hub at
https://sassmaker.com.
