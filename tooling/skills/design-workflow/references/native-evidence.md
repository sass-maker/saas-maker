# Native macOS evidence

Browser receipts default to `evidence.platform: web`; older receipts that omit
the field keep the same browser viewport requirements. For an Apple-native
macOS surface, opt in with `--platform native-macos --supported-minimum-width
600` (replace 600 with the application's supported minimum, never below 600).
This sets `evidence.platform: native-macos` and integer
`evidence.supportedMinimumWidth`. The receipt's `context.design` document
(default `DESIGN.md`) must include these standalone declarations, matching the
application's actual supported window size:

```text
Platform: native-macos
Supported minimum width: 600
```

Document the native application, reviewed window, capture method, and display
scale there as well. This profile is for native macOS windows; do not use it to
bypass browser responsive coverage. Unknown platforms fail validation.

## Capture the running application

1. Inspect the running surface in a browser, or the running macOS application
   for a `native-macos` receipt.
2. For web receipts, capture after screenshots at 390, 768, and 1440 pixels.
   For `native-macos`, capture at least three distinct actual PNG, JPEG, or
   WebP screenshots of the reviewed native window. Record each `path`, integer
   `width`, and positive integer `height` in logical window points, all widths
   at or above the documented minimum, with at least one exactly at minimum.
   Cover at least three distinct widths using representative larger windows
   and states; do not copy one image under
   multiple names. Creation supplies suggested widths and `height: null`;
   replace these with real captures and measured dimensions before checking.
   Validation checks image signatures and distinct file contents, but does not
   decode images, verify logical dimensions against Retina pixels, or prove
   that a capture depicts the running app. Inspect the actual evidence.

Native receipts also require the v2 direction, rendered craft and applicable product-continuity gates. Record the browser slop scanner exemption with its reason; native captures do not establish inspection of a paired web landing.
