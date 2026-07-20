#!/usr/bin/env bash
# seo-audit.sh — on-page SEO audit for a URL or list of URLs
# Usage:
#   seo-audit.sh <url> [--site <origin>]
#   seo-audit.sh <url-file> [--site <origin>]
set -uo pipefail
# NOTE: no `set -e` — grep returns non-zero when no matches, which is normal here.

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <url-or-url-file> [--site <origin>]"
  echo "Examples:"
  echo "  $0 https://example.com/"
  echo "  $0 /tmp/urls.txt --site https://example.com"
  exit 1
fi

INPUT="$1"
shift || true
SITE_ORIGIN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --site) SITE_ORIGIN="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Determine if input is a file or a URL
URLS=()
if [[ -f "$INPUT" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    URLS+=("$line")
  done < "$INPUT"
else
  URLS+=("$INPUT")
fi

if [[ ${#URLS[@]} -eq 0 ]]; then
  echo "No URLs to audit." >&2
  exit 1
fi

# --- helpers -------------------------------------------------------------

fetch() { curl -sL --max-time 30 "$1"; }

# extract <meta> content by name or property
meta_content() {
  local html="$1" attr="$2" val="$3"
  echo "$html" | grep -oiE "<meta ${attr}=\"${val}\"[^>]*>" | head -1 \
    | sed -E "s/.*content=\"([^\"]*)\".*/\1/I" | sed 's/&amp;/\&/g'
}

tag_text() {
  local html="$1" tag="$2"
  echo "$html" | grep -oiE "<${tag}[^>]*>[^<]*</${tag}>" | head -1 \
    | sed -E "s/<${tag}[^>]*>(.*)<\/${tag}>/\1/I" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

link_href() {
  local html="$1" rel="$2"
  echo "$html" | grep -oiE "<link rel=\"${rel}\"[^>]*>" | head -1 \
    | sed -E "s/.*href=\"([^\"]*)\".*/\1/I"
}

count_tag() {
  local html="$1" tag="$2"
  echo "$html" | grep -oiE "<${tag}[^>]*>" | wc -l | tr -d ' '
}

# strip tags, count words
word_count() {
  echo "$1" | sed 's/<[^>]*>/ /g' | tr -s ' \n' ' ' | wc -w | tr -d ' '
}

PASS=0; FAIL=0; WARN=0
FAILED_PAGES=()

audit_page() {
  local url="$1"
  local html
  html=$(fetch "$url") || { echo "  FETCH FAILED — could not retrieve $url" >&2; return; }

  echo "===== $url ====="

  # --- title ---
  local title
  title=$(tag_text "$html" "title")
  local title_len=${#title}
  if [[ -z "$title" ]]; then
    echo "  title              FAIL   missing"; ((FAIL++))
  elif [[ $title_len -lt 10 ]]; then
    echo "  title              WARN   too short ($title_len chars): \"$title\""; ((WARN++))
  elif [[ $title_len -gt 60 ]]; then
    echo "  title              WARN   too long ($title_len chars): \"$title\""; ((WARN++))
  else
    echo "  title              PASS   \"$title\" ($title_len chars)"; ((PASS++))
  fi

  # --- meta description ---
  local desc
  desc=$(meta_content "$html" "name" "description")
  local desc_len=${#desc}
  if [[ -z "$desc" ]]; then
    echo "  meta-description   FAIL   missing"; ((FAIL++))
  elif [[ $desc_len -lt 50 ]]; then
    echo "  meta-description   WARN   too short ($desc_len chars)"; ((WARN++))
  elif [[ $desc_len -gt 160 ]]; then
    echo "  meta-description   WARN   too long ($desc_len chars)"; ((WARN++))
  else
    echo "  meta-description   PASS   ($desc_len chars)"; ((PASS++))
  fi

  # --- canonical ---
  local canonical
  canonical=$(link_href "$html" "canonical")
  if [[ -z "$canonical" ]]; then
    echo "  canonical          FAIL   missing"; ((FAIL++))
  else
    echo "  canonical          PASS   $canonical"; ((PASS++))
  fi

  # --- OG tags ---
  local og_title og_desc og_image
  og_title=$(meta_content "$html" "property" "og:title")
  og_desc=$(meta_content "$html" "property" "og:description")
  og_image=$(meta_content "$html" "property" "og:image")
  if [[ -z "$og_title" ]]; then echo "  og:title           FAIL   missing"; ((FAIL++)); else echo "  og:title           PASS"; ((PASS++)); fi
  if [[ -z "$og_desc" ]];  then echo "  og:description    FAIL   missing"; ((FAIL++)); else echo "  og:description    PASS"; ((PASS++)); fi
  if [[ -z "$og_image" ]]; then echo "  og:image          FAIL   missing"; ((FAIL++)); else echo "  og:image          PASS   $og_image"; ((PASS++)); fi

  # --- twitter:card ---
  local tw_card
  tw_card=$(meta_content "$html" "name" "twitter:card")
  if [[ -z "$tw_card" ]]; then
    echo "  twitter:card       FAIL   missing"; ((FAIL++))
  else
    echo "  twitter:card       PASS   $tw_card"; ((PASS++))
  fi

  # --- hreflang ---
  local hreflang_count
  hreflang_count=$(echo "$html" | grep -oiE '<link rel="alternate"[^>]*hreflang=' | wc -l | tr -d ' ')
  if [[ $hreflang_count -eq 0 ]]; then
    echo "  hreflang           WARN   none found (ok for single-language sites)"; ((WARN++))
  else
    local has_xdefault
    has_xdefault=$(echo "$html" | grep -oiE 'hreflang="x-default"' | wc -l | tr -d ' ')
    if [[ $has_xdefault -eq 0 ]]; then
      echo "  hreflang           WARN   $hreflang_count alternates but no x-default"; ((WARN++))
    else
      echo "  hreflang           PASS   $hreflang_count alternates + x-default"; ((PASS++))
    fi
  fi

  # --- JSON-LD ---
  local jsonld_count
  jsonld_count=$(echo "$html" | grep -oiE '<script type="application/ld\+json">' | wc -l | tr -d ' ')
  if [[ $jsonld_count -eq 0 ]]; then
    echo "  json-ld            FAIL   no structured data"; ((FAIL++))
  else
    local jsonld_types
    jsonld_types=$(echo "$html" | grep -oiE '"@type"[^,]*' | sed 's/"@type"//' | tr -d ' "' | sort -u | tr '\n' ',' | sed 's/,$//')
    echo "  json-ld            PASS   $jsonld_count blocks ($jsonld_types)"; ((PASS++))
  fi

  # --- H1 ---
  # Multi-line <h1>…</h1> (common with nested spans) is one heading; use
  # perl multiline match so we don't double-count open tags only.
  local h1_count h1_text
  h1_count=$(echo "$html" | perl -0777 -ne 'print scalar(() = /<h1\b[^>]*>.*?<\/h1>/gis)')
  h1_count=${h1_count:-0}
  h1_text=$(echo "$html" | perl -0777 -ne 'if (/<h1\b[^>]*>(.*?)<\/h1>/is) { $_=$1; s/<[^>]+>/ /g; s/\s+/ /g; s/^\s+|\s+$//g; print; exit }')
  if [[ $h1_count -eq 0 ]]; then
    echo "  h1                 FAIL   no h1 found"; ((FAIL++))
  elif [[ $h1_count -gt 1 ]]; then
    echo "  h1                 FAIL   $h1_count h1s (should be exactly 1)"; ((FAIL++))
  elif [[ -z "$h1_text" ]]; then
    echo "  h1                 WARN   h1 present but empty text"; ((WARN++))
  else
    echo "  h1                 PASS   \"$h1_text\""; ((PASS++))
  fi

  # --- H2 hierarchy ---
  local h2_count h3_count h4_count
  h2_count=$(count_tag "$html" "h2")
  h3_count=$(count_tag "$html" "h3")
  h4_count=$(count_tag "$html" "h4")
  if [[ $h2_count -eq 0 ]]; then
    echo "  h2                 WARN   no h2s (page may lack structure)"; ((WARN++))
  elif [[ $h4_count -gt 0 && $h3_count -eq 0 ]]; then
    echo "  h2                 FAIL   h4 present but no h3 (skipped level)"; ((FAIL++))
  else
    echo "  h2                 PASS   $h2_count h2s, hierarchy ok"; ((PASS++))
  fi

  # --- image alt text ---
  local total_imgs imgs_no_alt
  total_imgs=$(echo "$html" | grep -oiE '<img[^>]*>' | wc -l | tr -d ' ')
  imgs_no_alt=$(echo "$html" | grep -oiE '<img[^>]*>' | grep -viE 'alt=' | wc -l | tr -d ' ')
  if [[ $total_imgs -eq 0 ]]; then
    echo "  img-alt            PASS   no images on page"; ((PASS++))
  elif [[ $imgs_no_alt -gt 0 ]]; then
    echo "  img-alt            FAIL   $imgs_no_alt of $total_imgs images missing alt"; ((FAIL++))
  else
    echo "  img-alt            PASS   all $total_imgs images have alt"; ((PASS++))
  fi

  # --- word count ---
  local wc_count
  wc_count=$(word_count "$html")
  if [[ $wc_count -lt 300 ]]; then
    echo "  word-count         WARN   ~$wc_count words (thin content)"; ((WARN++))
  else
    echo "  word-count         PASS   ~$wc_count words"; ((PASS++))
  fi

  # --- SSR leak ---
  # Strip <script>, <style>, and <code>/<pre> blocks — docs and marketing pages
  # legitimately show `${}` / `{{` in code samples. Real SSR leaks appear in
  # visible HTML / href attributes outside those contexts.
  local html_no_script
  html_no_script=$(echo "$html" | perl -0777 -pe '
    s/<script\b[^>]*>.*?<\/script>//gis;
    s/<style\b[^>]*>.*?<\/style>//gis;
    s/<code\b[^>]*>.*?<\/code>//gis;
    s/<pre\b[^>]*>.*?<\/pre>//gis;
  ')
  local leak_count
  leak_count=$(echo "$html_no_script" | grep -cE '\$\{|{{|<%=' || true)
  if [[ $leak_count -gt 0 ]]; then
    echo "  ssr-leak           FAIL   $leak_count unrendered template literals in HTML"; ((FAIL++))
  else
    echo "  ssr-leak           PASS   no template literals in HTML"; ((PASS++))
  fi

  # --- broken internal links ---
  local broken_links
  broken_links=$(echo "$html" | grep -oiE 'href="[^"]*\$\{[^"]*"' | wc -l | tr -d ' ')
  if [[ $broken_links -gt 0 ]]; then
    echo "  broken-links       FAIL   $broken_links hrefs with template placeholders"; ((FAIL++))
  else
    echo "  broken-links       PASS   no broken internal links"; ((PASS++))
  fi

  # page summary
  local page_fail
  page_fail=0
  [[ -z "$title" ]] && page_fail=1
  [[ -z "$desc" ]] && page_fail=1
  [[ -z "$canonical" ]] && page_fail=1
  [[ -z "$og_title" ]] && page_fail=1
  [[ -z "$og_image" ]] && page_fail=1
  [[ -z "$tw_card" ]] && page_fail=1
  [[ $jsonld_count -eq 0 ]] && page_fail=1
  [[ $h1_count -ne 1 ]] && page_fail=1
  [[ $h4_count -gt 0 && $h3_count -eq 0 ]] && page_fail=1
  [[ $imgs_no_alt -gt 0 ]] && page_fail=1
  [[ $leak_count -gt 0 ]] && page_fail=1
  [[ $broken_links -gt 0 ]] && page_fail=1

  if [[ $page_fail -gt 0 ]]; then
    echo -e "\n  → page has failures (see above)"
    FAILED_PAGES+=("$url")
  else
    echo -e "\n  → all critical checks passed"
  fi
  echo
}

audit_site() {
  local origin="$1"
  echo "===== SITE-LEVEL: $origin ====="

  # robots.txt
  local robots
  robots=$(fetch "$origin/robots.txt") || true
  if [[ -z "$robots" ]]; then
    echo "  robots.txt         FAIL   not found or empty"; ((FAIL++))
  else
    local ua_count
    ua_count=$(echo "$robots" | grep -ciE '^User-agent:' || true)
    if [[ $ua_count -eq 0 ]]; then
      echo "  robots.txt         FAIL   no User-agent directives"; ((FAIL++))
    else
      echo "  robots.txt         PASS   $ua_count User-agent blocks"; ((PASS++))
    fi
  fi

  # sitemap reference in robots.txt
  local sitemap_url
  sitemap_url=$(echo "$robots" | grep -oiE '^Sitemap: .*' | head -1 | sed 's/^Sitemap: //I' | tr -d ' ')
  if [[ -z "$sitemap_url" ]]; then
    echo "  sitemap-ref        FAIL   no Sitemap: directive in robots.txt"; ((FAIL++))
  else
    local sitemap_status
    sitemap_status=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 15 "$sitemap_url")
    if [[ $sitemap_status -ge 200 && $sitemap_status -lt 300 ]]; then
      echo "  sitemap-ref        PASS   $sitemap_url ($sitemap_status)"; ((PASS++))
    else
      echo "  sitemap-ref        FAIL   $sitemap_url returned $sitemap_status"; ((FAIL++))
    fi
  fi

  # sitemap coverage — check that all audited URLs appear in the sitemap
  if [[ -n "$sitemap_url" ]]; then
    local sitemap_xml sitemap_locs
    sitemap_xml=$(fetch "$sitemap_url")
    # if it's a sitemap index, fetch ALL child sitemaps and merge their URLs
    # (large sites split across many child sitemaps — checking only the first
    # one causes false "not found in sitemap" warnings).
    if echo "$sitemap_xml" | grep -qi '<sitemapindex'; then
      local child_urls
      child_urls=$(echo "$sitemap_xml" | grep -oiE '<loc>[^<]*</loc>' | sed 's/<loc>//;s/<\/loc>//')
      local merged=""
      while IFS= read -r child; do
        [[ -z "$child" ]] && continue
        local child_xml
        child_xml=$(fetch "$child") || true
        merged+="$child_xml"$'\n'
      done <<< "$child_urls"
      sitemap_locs=$(echo "$merged" | grep -oiE '<loc>[^<]*</loc>' | sed 's/<loc>//;s/<\/loc>//' | sort -u)
    else
      sitemap_locs=$(echo "$sitemap_xml" | grep -oiE '<loc>[^<]*</loc>' | sed 's/<loc>//;s/<\/loc>//' | sort -u)
    fi

    local missing=0
    # Write normalized sitemap URLs to a temp file so grep -xF can handle
    # very large sitemaps (100k+ URLs) without pipe-buffer truncation.
    local tmp_locs
    tmp_locs=$(mktemp)
    echo "$sitemap_locs" | sed 's#/$##' > "$tmp_locs"
    for url in "${URLS[@]}"; do
      # Normalize: strip trailing slash (except root) so https://site/ matches
      # https://site in the sitemap and vice-versa.
      local norm_url="${url%/}"
      if ! grep -qxF "$norm_url" "$tmp_locs"; then
        echo "  sitemap-coverage   WARN   $url not found in sitemap"; ((WARN++))
        ((missing++))
      fi
    done
    rm -f "$tmp_locs"
    if [[ $missing -eq 0 ]]; then
      echo "  sitemap-coverage   PASS   all audited URLs in sitemap"; ((PASS++))
    fi
  fi
  echo
}

# --- run -----------------------------------------------------------------

for url in "${URLS[@]}"; do
  audit_page "$url"
done

if [[ -n "$SITE_ORIGIN" ]]; then
  audit_site "$SITE_ORIGIN"
fi

echo "===== SUMMARY ====="
echo "  ${#URLS[@]} pages audited"
echo "  $PASS checks passed, $FAIL failed, $WARN warnings"
if [[ ${#FAILED_PAGES[@]} -gt 0 ]]; then
  echo "  Pages with failures:"
  for p in "${FAILED_PAGES[@]}"; do
    echo "    $p"
  done
  exit 1
fi
exit 0
