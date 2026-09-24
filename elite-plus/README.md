# Elite+ Wellness Clinics — website

A static, multilingual site (EN default, AR right-to-left, TR, DE, ES) with a free-assessment lead funnel.
Pages are generated from one data file plus one translation file per language. There is no CMS: content changes are edits to JSON files, followed by a rebuild.

```
elite-plus/
  _src/config.json        clinic data: services, prices, doctors, results, contact, integrations
  _src/i18n/<lang>.json   every word of the site per language (same keys in all 5 files)
  _src/build.mjs          generator  ->  <lang>/…/index.html, sitemaps, robots.txt
  _src/og.mjs             social share images + app icon (Chromium)
  _src/placeholders.mjs   brand placeholder artwork (replace with real photography)
  _backend/               Supabase schema + lead-intake edge function + tests (see _backend/README.md)
  assets/                 css, js, fonts (self-hosted), img
  _headers                security headers for Cloudflare Pages / Netlify
```

Folders starting with `_` are not published by GitHub Pages/Jekyll.

## Preview locally (VS Code)

```bash
cd elite-plus
npm start        # builds, then serves at http://localhost:8080/C-H-import-and-export/elite-plus/en/
```

The terminal also prints a `Phone (same Wi-Fi)` address for testing on a real phone.
Do not use Live Server or open the HTML files directly: links are root-relative to `site.basePath`, so they only resolve when served under that path.

## Build

Requires Node 20+. No npm packages are needed.

```bash
node _src/build.mjs          # preview build: missing data shows as dashed orange chips, pages are noindex
node _src/build.mjs --prod   # production build: refuses to write anything while data or translations are missing
```

The preview build ends with the list of open items. `--prod` succeeds only when that list is empty.
Commit the generated HTML together with the source change.

## Staff guide

**Rule for all content:** never replace a `null` with an estimate. Stats, ratings, doctors, results, accreditations and prices must be real and verifiable (Turkish health-advertising rules, and the brief). No superlatives ("best", "No. 1", "guaranteed", "painless").

| Task | Where |
|---|---|
| Clinic name, licence, address, phone, WhatsApp, hours, social links | `config.json → clinic` |
| Trust bar (patients treated, Google rating, MoH licence, languages) | `config.json → stats` (items with `null` are hidden in production) |
| Service text (intro, who it is for, steps, stay, FAQ, extra assessment questions) | `config.json → services[i].content.<lang>` (see `_servicesContentExample`) |
| Service starting price | `config.json → services[i].priceFrom` (number, currency in `package.currency`) |
| Package inclusions (hotel nights, follow-up months) | `config.json → package` |
| Add a doctor | Add photo to `assets/img/doctors/`, add an entry to `config.json → doctors` (see `_doctorExample`). A profile page is generated automatically. |
| Add a before/after case | Only with a signed consent form. Photos in `assets/img/results/`, entry in `config.json → results` with `consentRef`. |
| Welcome (hero) image | Save the clean photo as `assets/img/hero/welcome.jpg`. Optional sharper versions: `welcome-800.webp`, `welcome-1200.webp`, `welcome-1600.webp`. Adjust the crop with `hero.focus` (e.g. `"32% 42%"`). |
| About page story and equipment | `config.json → about` |
| Wording anywhere | `_src/i18n/<lang>.json`; change the same key in all 5 files |
| Legal pages | Lawyer-approved text is still required (currently headings only) |

After editing: run the build, open the page locally (`npx http-server .. -p 8080`, then visit `/elite-plus/en/`), then commit.

### Reading the leads

Leads arrive in Supabase (`leads` table), by email/Telegram (name, phone, country, interest; no health details), and in the clinic CRM when `CRM_WEBHOOK_URL` is set.
- `status`: `partial` (left after entering a phone number; follow up) → `new` → `contacted` → `qualified` → `booked` / `lost` / `spam`.
- `abandoned_leads` view: partial leads older than 30 minutes.
- `lead_report` view: leads per day, language, treatment, source and campaign.
- Photos are in the private `lead-photos` bucket and can only be opened through signed links.

## Integrations

Set in `config.json → integrations`, then rebuild:
- `leadEndpoint` / `uploadUrlEndpoint`: the deployed edge function (`https://<project>.supabase.co/functions/v1/leads` and `…/leads/upload-url`).
- `turnstileSiteKey`: Cloudflare Turnstile (invisible, no puzzles).
- `gtmId`: Google Tag Manager. It is loaded **only after consent**; Google Consent Mode v2 defaults to denied. Configure GA4, Google Ads, Meta (with Conversions API) and TikTok/Snap inside GTM, triggered on these dataLayer events: `cta_click`, `whatsapp_click`, `phone_click`, `quiz_start`, `quiz_step` (with `quiz_step`, `quiz_step_name`), `photo_upload`, `lead_partial`, `lead_submit`, `consent_update`.
- `clarityId`: Microsoft Clarity, loaded only after analytics consent.

## Technical notes

- Languages live in sub-folders (`/ar/`, `/en/`…) with full `hreflang` + `x-default` (EN). Visitors are never redirected: a dismissible banner suggests their browser language.
- RTL is handled by one set of components using logical CSS properties. The hero image is mirrored in Arabic so the subject faces into the page.
- Fonts: the brand fonts (Brice, Century Gothic, Montserrat Arabic) are commercial. Until web licences are bought, free stand-ins are self-hosted (Outfit, Questrial, Tajawal). With licences: add the WOFF2 files to `assets/fonts/` and `@font-face` rules; the font stacks already list the brand fonts first.
- The logo SVGs were vector-traced from the brand-guidelines PDF (a raster file). Replace them with the designer's original vector export when available.
- Photo uploads are compressed in the browser (max 2000 px, JPEG) and stored in a private bucket; partial leads contain contact details only, never health answers or photos.
- Structured data: `MedicalClinic`, `MedicalProcedure`, `Physician`, `FAQPage`, `BreadcrumbList`, `MedicalWebPage`. `AggregateRating` is output only when a real Google rating is configured.

## Hosting

GitHub Pages works for the preview, but it cannot send security headers and the preview is `noindex`.
For launch: serve the `elite-plus` folder from Cloudflare Pages (or put Cloudflare in front) on the clinic's domain, set `site.origin`/`site.basePath` in `config.json` (e.g. `https://eliteplusclinics.com` and `""`), rebuild with `--prod`, and make sure `robots.txt` is served at the domain root.

## Pre-launch checklist

- [ ] `node _src/build.mjs --prod` passes (no missing data or translations)
- [ ] Clean welcome photo supplied (no baked-in logo or rays), ideally ≥ 2400 px wide
- [ ] Native speakers have reviewed AR, TR, DE, ES (the current translations are professional drafts, not native-reviewed)
- [ ] Medical team has approved every treatment text, the FUE/DHI section (`techniquesConfirmed`), and the FAQ answers
- [ ] Service names confirmed, especially "Regenera Activa" (the brief said "Reginera") and "G-Cell"
- [ ] Stem-cell / regenerative treatment wording checked against Turkish Ministry of Health rules
- [ ] Turkish healthcare lawyer has signed off on all copy, before/after consents, privacy, KVKK, cookie and terms pages, and the Impressum
- [ ] "Reply within 24 hours" is an operational promise the team can keep (`promise.responseHours`)
- [ ] Backend deployed, `_backend` tests passing, one real test lead received by email/Telegram/CRM and deleted afterwards
- [ ] GTM container published with consent-aware tags; conversions verified in GA4 / Google Ads / Meta Events Manager
- [ ] Security headers active (`curl -I https://domain/en/`), HTTPS only
- [ ] Lighthouse mobile ≥ 90 in all four categories on home, a service page and the assessment
- [ ] axe accessibility scan clean; keyboard-only run through the menu, carousels, FAQ and assessment
- [ ] Assessment tested on a real iPhone (Safari, HEIC photo from the camera) and Android (Chrome)
- [ ] Google Business Profile linked; sitemap submitted in Search Console for each language
