# GitHub organization logos

Premium square avatars for every GitHub org under the fleet / personal stack.

Generated 2026-07-17. Primary deliverable: **`*-avatar-1024.png`** (upload this to GitHub).

## Fleet product orgs

| Org | Mark | Upload |
|---|---|---|
| [Codevetter](https://github.com/Codevetter) | Nested gold diamond gem | [profile settings](https://github.com/organizations/Codevetter/settings/profile) |
| [High-Signal-App](https://github.com/High-Signal-App) | Cyan signal waveform | [profile settings](https://github.com/organizations/High-Signal-App/settings/profile) |
| [Significant-Hobbies](https://github.com/Significant-Hobbies) | Interlocking emerald rings + core | [profile settings](https://github.com/organizations/Significant-Hobbies/settings/profile) |
| [HeyPace](https://github.com/HeyPace) | Blue equalizer bars | [profile settings](https://github.com/organizations/HeyPace/settings/profile) |
| [PostTrainLLM](https://github.com/PostTrainLLM) | Teal learning curve + endpoint | [profile settings](https://github.com/organizations/PostTrainLLM/settings/profile) |
| [sass-maker](https://github.com/sass-maker) | Gold forge multipoint star | [profile settings](https://github.com/organizations/sass-maker/settings/profile) |

## Other orgs

| Org | Mark | Upload |
|---|---|---|
| [vaultwealth-ltd](https://github.com/vaultwealth-ltd) | Gold vault / shield keyhole | [profile settings](https://github.com/organizations/vaultwealth-ltd/settings/profile) |
| [manipalthetalk](https://github.com/manipalthetalk) | Speech / media mark | [profile settings](https://github.com/organizations/manipalthetalk/settings/profile) |
| [ADG-Manipal](https://github.com/ADG-Manipal) | Developer geometric mark | [profile settings](https://github.com/organizations/ADG-Manipal/settings/profile) |

## Files per org

```
{Org}-avatar-1024.png   # master — use this for GitHub
{Org}-avatar-512.png    # mid-res
{Org}-avatar.jpg        # web preview
```

## How to set on GitHub

GitHub has **no public API** for org avatars. Manual steps:

1. Open the org **Settings → Profile** link above (org owner required).
2. Click the avatar / “Upload new picture”.
3. Choose `{Org}-avatar-1024.png`.
4. Crop if GitHub offers a cropper (keep the full mark centered).
5. Save.

Or open all fleet settings at once:

```bash
open \
  https://github.com/organizations/Codevetter/settings/profile \
  https://github.com/organizations/High-Signal-App/settings/profile \
  https://github.com/organizations/Significant-Hobbies/settings/profile \
  https://github.com/organizations/HeyPace/settings/profile \
  https://github.com/organizations/PostTrainLLM/settings/profile \
  https://github.com/organizations/sass-maker/settings/profile
```

## Local preview

```bash
open fleet-ops/assets/github-org-logos/preview.html
```
