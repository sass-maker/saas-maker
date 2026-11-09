---
name: product-assets
description: Find, inventory, or update Fleet product logos, screenshots, launch videos, listing copy, and the shared Drive and public submission kits. Use for asset-library maintenance or preparing product files for an authorized directory submission.
---

# Product assets

The owner's Drive folder **Fleet Product Assets** is the human and agent file
library. Search Drive for it and read its `START-HERE.txt` and
`Fleet-product-asset-index.json`; do not rely on a cached download as current
state. Product folders and the index include private inventories as well as
public kits. Find a logo by product name and image type, then retrieve the
named PNG or SVG. For a submission, use the matching brief and check the
destination's actual file requirements. Missing or dated material is not a
current approved claim.

The private owner source for public listing metadata is
`site-health/catalog/projects.json`, under each product's
`presentation.directory.submission`. SaaS Maker owns the generated public
projection, checked-in web images and Launchkit exporter. Public eligibility
is governed by the existing catalog; a Drive file or public repository alone
does not authorize publishing an internal product. Never put private Drive IDs,
local paths, private screenshots, account data or bearer URLs in the public
projection. Keep originals and prior versions recoverable.

## Refresh after a change

1. Identify the exact product and requested assets. Inspect the current source,
   Drive folder and index, and existing public kit. Establish that proposed
   assets are intended for the destination; distinguish source evidence,
   capture dates, incomplete inventories and approved listing facts.
2. Update the owner Drive copy through the Google Drive connector. Ground the
   existing file by ID and replace its bytes in place when preserving its link;
   upload only genuinely new files. Check returned errors and read back names,
   sizes and IDs. If a write's outcome is uncertain, reconcile before retrying
   so that duplicates are not created. Preserve sharing and ownership.
3. For an eligible public product, update the canonical metadata and the actual
   public files in SaaS Maker, then run `pnpm catalog:sync-public`; never hand
   edit `catalog/generated/public.json`. Use an isolated writer checkout if the
   main checkout is dirty. Video files belong in the dedicated public asset
   bucket, not Git. Use versioned object names when changing bytes to avoid
   stale caches. Its attachment rule requires the exact `?download=1` URL;
   retain a bare `viewUrl` for playback. Verify public visibility, MIME type,
   size, bytes and the attachment header, including a browser upload where
   that behavior changed. Do not expose the private feedback bucket.
4. Regenerate the affected brief and JSON from the same updated kit, update the
   corresponding Drive files and the master index in place, and refresh
   `START-HERE.txt` if its inventory description changes. Preserve entries for
   other projects and re-read the latest index immediately before writing.
5. Fetch a **fresh** Drive index through the connector and run from the SaaS
   Maker checkout:

   ```sh
   node tooling/launchkit/scripts/audit-assets.mjs --index /path/to/fresh-index.json --product <product-id>
   pnpm catalog:check-public
   ```

   Omit `--product` for all current projects. The audit checks index links and
   local image sizes and poster presence; it does not fetch Drive, compare file
   hashes, verify permissions or check production. An orphaned index entry needs
   investigation, not automatic deletion. The Drive index is a JSON object with
   `products[]` entries keyed by `id`, each having `driveFolderUrl` and `assets[]`;
   current public-kit asset entries use `publicDownloadUrl` matching the kit.
   Private files may omit it; mark historical entries `archived: true` rather
   than listing an old URL as a current public download. Public logo, screenshot
   and video entries are checked against the kit; document, brief and JSON
   entries are ignored for asset reconciliation. Untyped public entries are
   checked as assets; other unrecognized public kinds are reported as issues.
   Independently inspect the actual changed
   Drive and public bytes. A 200 HTML fallback is not a JSON kit. Build, follow
   the existing release guard, and verify live routes only when a public site
   release is in scope and authentication is available.

On partial failure, say which copies were updated and which remain pending;
do not claim synchronization or invent a missing logo, screenshot, pricing or
video. Where the optional macOS product-asset watcher is installed, inspect its
status and pending recovery before making overlapping updates. The watcher
checks local product changes and updates only existing indexed Drive files; it
does not create missing entries or publish the public kit. Confirm the service is
actually running before calling it automatic. Its private state is under
`~/Library/Application Support/Fleet/Product Asset Watch/`; preserve pending
work and backups, and report any recovery or verification gaps. The user's
current instructions control submission and publishing permissions.

For an installed watcher, read the owned LaunchAgent paths and inspect status:

```sh
PLIST="$HOME/Library/LaunchAgents/com.sarthak.fleet-product-assets.plist"
WATCHER=$(/usr/bin/plutil -extract ProgramArguments.4 raw -o - "$PLIST")
STATE=$(/usr/bin/plutil -extract EnvironmentVariables.FLEET_ASSET_WATCH_STATE raw -o - "$PLIST")
FLEET_ASSET_WATCH_STATE="$STATE" /opt/homebrew/bin/node "$WATCHER" --status
/bin/launchctl print "gui/$(id -u)/com.sarthak.fleet-product-assets"
```

To resolve a recovery, first inspect the affected files and retained backup.
Stop the owned service, run the resolver under its supervisor lock, and restart
the same plist even if resolution fails:

```sh
SUPERVISOR=$(/usr/bin/plutil -extract ProgramArguments.1 raw -o - "$PLIST")
INDEX=$(/usr/bin/plutil -extract EnvironmentVariables.FLEET_ASSET_INDEX raw -o - "$PLIST")
/bin/launchctl bootout "gui/$(id -u)/com.sarthak.fleet-product-assets"
FLEET_ASSET_INDEX="$INDEX" FLEET_ASSET_WATCH_STATE="$STATE" /usr/bin/python3 "$SUPERVISOR" "$STATE" /opt/homebrew/bin/node "$WATCHER" --resolve PRODUCT_ID
/bin/launchctl bootstrap "gui/$(id -u)" "$PLIST"
```

If the resolver reports a reviewable partial or externally changed batch,
`--accept-current` explicitly records acceptance of the current files for
replanning. Use it only after comparing them with the retained backups. Invalid
Drive identities or backups remain blocked. Neither resolution mode deletes the
backup. If the state file is corrupt, preserve the original and its named
`state.corrupt-*.json` copy; stop the service and investigate before restoring.
