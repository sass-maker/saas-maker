# GitHub organization logos

Flat geometric avatars for **orgs you own** (sole admin). No glossy AI-icon look.

## Orgs included

| Org | Mark | Settings |
|---|---|---|
| [Codevetter](https://github.com/Codevetter) | Nested diamond | [profile](https://github.com/organizations/Codevetter/settings/profile) |
| [High-Signal-App](https://github.com/High-Signal-App) | Waveform + baseline | [profile](https://github.com/organizations/High-Signal-App/settings/profile) |
| [Significant-Hobbies](https://github.com/Significant-Hobbies) | Two rings + core | [profile](https://github.com/organizations/Significant-Hobbies/settings/profile) |
| [HeyPace](https://github.com/HeyPace) | Four pace bars | [profile](https://github.com/organizations/HeyPace/settings/profile) |
| [PostTrainLLM](https://github.com/PostTrainLLM) | Training curve | [profile](https://github.com/organizations/PostTrainLLM/settings/profile) |
| [sass-maker](https://github.com/sass-maker) | Copper **F** (Foundry) | [profile](https://github.com/organizations/sass-maker/settings/profile) |

## Intentionally excluded

- **vaultwealth-ltd** — co-owned; not sole owner
- **manipalthetalk**, **ADG-Manipal** — member only, not owner

## Files

`{Org}-mark.svg` — vector source (authoritative)  
`{Org}-avatar-1024.png` — upload this to GitHub  
`{Org}-avatar-512.png` / `{Org}-avatar.jpg` — previews

## Regenerate

```bash
node fleet-ops/scripts/generate-org-logos.mjs
```

## Design rules

- Flat fills, hard edges, 2–3 colors
- No chrome, neon glow, bevels, or lens flare
- Same family as product favicons
- Marks work at 16px and 1024px

## Upload

GitHub has no org-avatar API. Settings → Profile → upload `*-avatar-1024.png`.

```bash
open fleet-ops/assets/github-org-logos/preview.html
open fleet-ops/assets/github-org-logos
```
