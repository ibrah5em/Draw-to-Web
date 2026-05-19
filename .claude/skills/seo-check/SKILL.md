---
description: Validate SEO metadata on generated output. Use when user asks about SEO, meta tags, Open Graph, JSON-LD, or head tags.
---

## Scope

Maps to tasks `I-SEO-01..07` in `docs/0.2.0v/plan.md` Section 10.5.

## Instructions

1. Read the generated HTML output (find a recent export in `dist/`, `out/`, or `tests/fixtures/output/`).
2. **Required `<head>` content** (I-SEO-01):
   - `<meta charset="utf-8">`
   - `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   - `<title>` non-empty
   - `<meta name="description">` non-empty
   - `<meta name="keywords">` if configured
   - `<meta name="author">` if configured
   - `<html lang="...">`
   - `<meta name="theme-color">` for each color scheme present in the document
   - `<link rel="canonical">` if `document.seo.canonical` is set
3. **Open Graph + Twitter Card** (I-SEO-02):
   - `og:title`, `og:description`, `og:type`, `og:url` (if canonical)
   - `og:image` if configured
   - `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`
4. **JSON-LD** (I-SEO-03):
   - `<script type="application/ld+json">` block present if `document.seo.schema` is set
   - JSON parses cleanly (must have been emitted via `JSON.stringify`, never string-concat)
   - Required fields per type: `Person` (`name`, `url`), `Organization` (`name`, `url`, `logo`), `WebSite` (`name`, `url`)
5. **Performance hints** (I-SEO-05):
   - `preconnect` + `dns-prefetch` for every external origin emitted (Google Fonts, icon CDNs)
6. **Heading structure** (I-DOC-05):
   - Exactly one `<h1>` per page
   - No skipped levels (h1 → h3 without h2 = warning)
7. **Favicon** (I-SEO-04):
   - `<link rel="icon">` present (inline SVG data URI by default)
   - SVG uses `prefers-color-scheme` for dark/light
8. **Bundle-level emits** (I-SEO-06, I-SEO-07):
   - `sitemap.xml` present in bundle and validates against sitemaps.org schema
   - `robots.txt` present and validates against robots-validator (allow all, points to sitemap)

## Output Format

Markdown table: **Tag / File | Present | Value | Issue (if any)**. End with a one-line verdict and a count of `errors / warnings`. Map each failure to its `I-SEO-NN` task so the author knows which DoD to revisit.
