# Precise Fleet footer

`registerFleetFooter()` registers `fleet-footer-extension`. All helpers are inside the function so the hosted loader may serialize it without imported runtime bindings. Repeated registration is harmless. Updating attributes never rebuilds the shadow tree or clones/reparents a slotted child.

## Child contract

| Slot | Owning child / placement |
| --- | --- |
| `cta` | Existing product action, first in left column; suppressed in `surface="app"`. |
| `navigation` | Original native routes and legal, left column. Preserve authored grouped links/details. |
| `feedback` | Original feedback/support action and its existing handler, left column. |
| `ai` | Existing AI child with `layout="question"`: editable labelled question, five accessible icon-only handoffs, no duplicate chips. Child owns URL synchronization and question state. |
| `capture` | Existing capture child in integrated compact/open mode. Child owns heading, email, required unchecked consent, status and API behavior. Actual children always remain visible, even when automatic configuration is disabled. |
| `projects` | Existing strip child with `layout="studio"`: one static names-only row, From the studio, three safe catalog links and All projects. Child owns distribution and narrow-width wrapping (no clipping or local scroll). Frame adds no duplicate caption, cards or links. This slot is absolutely last. |

The component does not insert a preview form or fake answer. The hosted loader/integration owns attaching existing children and respecting opt-outs. The component never does that attachment or searches/reparents native page regions.

## Attributes and lifecycle

Existing `product-name`, `theme`, `surface`, `art-src`, `art-alt`, `art-width`, `art-height`, `art-position`, `art-credit`, `show-updates`, and `capture-status` remain supported. Artwork URLs reject credentials and non-HTTP(S) schemes. Focal position must be two percentages in0–100; dimensions must be integers1–4096. Credit is image title metadata, not an overlay caption.

`signature-name` sets the visible native brand. PH Catalog/Atlas defaults to “Atlas”; otherwise the product name is used. `signature-font="newsreader"` uses the serif signature; `ui` uses the UI family; `inherit` lets host signature typography prevail. Atlas defaults to Newsreader. Override `--fleet-footer-signature-font` for another product's actual native display identity.

`show-updates="true"` keeps the capture area open while configuration loads. `capture-status="unavailable"` shows an explicit unavailable status and Try again. Clicking retry emits the existing bubbling/composed `capture-retry` event; connecting/reconnecting emits `footer-connect`. A slotted capture child hides frame loading/retry copy and remains visible. There is no configuration request, automatic retry loop, form submit or persistence in this module.

`font-base` defaults to `https://sassmaker.com/fonts/fleet-footer-precise-v1/`. Same-origin paths/bases are supported for local or product-owned serving; other cross-origin bases, credentials, queries, fragments and non-HTTP(S) schemes fail closed. `fonts="false"` disables frame font registration and uses host/system fallbacks. Each valid base registers one document-head style containing isolated Fleet font-family aliases; these declarations do not change body styles. URL text is normalized and escaped, and fixed asset filenames cannot inject CSS. Font load/CSP/CORS success is a release/browser check, not inferred from registration.

## Scoped styles

Inherited child variables: `--fleet-footer-ui-font`, `--fleet-footer-mono-font`, and `--fleet-footer-label-font` (Mono alias). The font loader owns only `--fleet-footer-loaded-{ui,mono,signature}` defaults. Children should consume the public variables and inherit color.

Native light-DOM rules are restricted to direct slotted wrappers under `fleet-footer-extension`: navigation anchors/summary typography and inline-flex44px targets; category heading typography; feedback-button typography. No native links are cloned or replaced. Optional authored hooks are `data-fleet-footer-primary`, `data-fleet-footer-group-label`, and `data-fleet-footer-legal`. Native group layout is preserved; owning integrations may compose existing groups using these hooks.

Host palette/fade variables: `--fleet-footer-canvas` and `--fleet-footer-lower` are explicit product-owned opaque native colors when supplied. On connect and a theme attribute change, the frame inspects only computed backgroundColor on itself and up to seven parents, stopping at an opaque RGB/RGBA color. It collects no content, links or app data. This sets an internal fallback only, so host palette variables retain precedence. When no concrete native background is available, dark uses#171717 and light uses#fafaf9; the default lower plane uses the resolved canvas, so the fade is concrete rather than transparent. Hosts may supply a distinct native lower wash. `--fleet-footer-border`, `--fleet-footer-muted`, and `--fleet-footer-focus` are overridable. Hosts own `--fleet-footer-edge`, `--fleet-footer-max-width`, signature sizes, art-height/mobile-art-height and their app variants. These preserve product identity and long-brand fit; do not cover a scene's central mechanism.

Exported parts: `root`, `plane`, `middle`, `product`, `services`, `cta`, `navigation`, `feedback`, `ai`, `capture`, `capture-status`, `capture-retry`, `art-stage`, `signature`, `wordmark`, `art`, `art-fallback`, `studio`, and `projects`. The studio child may consume `--portfolio-strip-edge` and `--portfolio-strip-ui-font` provided by the frame.

Fonts are exact local OFL assets under `apps/showcase/public/fonts/fleet-footer-precise-v1`, with licenses and provenance hashes. They must be served as WOFF2 with CORS access for hosted cross-origin footer consumers. No Google Fonts runtime request or dependency is introduced.

## Qualification

Focused tests: `node --test packages/fleet-footer/test/composition.test.mjs` through the root-managed workspace runner. They cover serialized registration, immutable original controls across updates/reconnects, open capture/unavailable/manual retry, art recovery, unsafe URL/font rejection and final studio order. The narrow DOM double is not browser/render/font-load proof. Static `node --check` is safe; the release owner runs heavyweight checks, actual integration qualification and publication.
