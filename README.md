# Startup DNA

A static website for the [Startup DNA](https://www.youtube.com/@yourStartupDNA) founder-interview podcast from Taipei.

No framework. HTML is generated from JSON. `node build.js` minifies HTML, CSS, and JS (needs `npm install` once for [esbuild](https://esbuild.github.io/)).

## Discord copy edits

The show operator can change bios, taglines, and other JSON copy from Discord. Type `/edit-text`, paste a snippet of the current copy, edit the form, then **Publish**. Setup: [`agent/README.md`](agent/README.md).

## Preview locally

```bash
npm install
node build.js
python3 -m http.server 8765
```

Then open http://127.0.0.1:8765/startupdna/

## Add an episode

1. Add a record to [`data/episodes.json`](data/episodes.json). Required fields: `id` (YouTube video ID), `slug`, `series`, `title`, `guests` (founder slugs), `guestLabel`, `company`, `sectors`, `duration`, `published` (`YYYY-MM-DD`), `description`, `takeaways`.
2. Add matching founder records to [`data/founders.json`](data/founders.json) if they are new guests. Bios should cite public sources; skip unverifiable numbers.
3. Run `node build.js`.
4. Commit the JSON **and** the generated HTML under `startupdna/` (`startupdna/index.html`, `startupdna/episodes.html`, `startupdna/founders/*.html`, etc.).

Show copy lives in [`data/site.json`](data/site.json) (tagline, manifesto, partners, social links, host bio).

## Deploy

Drop the project folder onto [Netlify](https://www.netlify.com/drop/), [Cloudflare Pages](https://pages.cloudflare.com/), GitHub Pages, or any static host. Publish the repo root. The site is served at `/startupdna/`; `/` redirects there.

**Vercel** installs esbuild, runs `node build.js`, and publishes minified files from `dist/` (`vercel.json`). URLs stay at `/startupdna/`. Source CSS/JS in `assets/` stay readable; the generated copies under `startupdna/` and `dist/` are minified.

On other hosts, if you want a build command:

```
node build.js
```

Publish directory: `/`

## Hook up the forms

Newsletter, guest pitch, and partner forms are Netlify Forms–ready (`data-netlify="true"` + honeypot). On Netlify they work as soon as you deploy.

On another host, replace the Formspree placeholder in [`data/site.json`](data/site.json):

```json
"forms": {
  "provider": "formspree",
  "formspreeEndpoint": "https://formspree.io/f/YOUR_FORM_ID"
}
```

Then run `node build.js` again.

## Brand assets

The official mark is the circular badge: electric blue field (`#3036FC`), white condensed **STARTUP / DNA** wordmark, and yellow → orange sequencer bars.

| File | Use |
| --- | --- |
| [`assets/img/logo.png`](assets/img/logo.png) | Primary on-page mark (tight circular crop, transparent corners) |
| [`assets/img/logo.svg`](assets/img/logo.svg) | Vector companion / SVG favicon |
| [`assets/img/favicon.png`](assets/img/favicon.png) | 32×32 tab icon |
| [`assets/img/apple-touch-icon.png`](assets/img/apple-touch-icon.png) | 180×180 home-screen icon |
| [`assets/img/helix.svg`](assets/img/helix.svg) | Decorative sequencer-bar motif (not the brand mark) |
| [`assets/img/logo-source.jpg`](assets/img/logo-source.jpg) | Source artwork |

Do not redistribute YouTube thumbnails as original artwork; they are loaded from YouTube’s CDN at runtime.

## Pages

| Path | What it is |
| --- | --- |
| `/startupdna/` | Home: latest episode, recent shows, founder grid, manifesto |
| `/startupdna/episodes.html` | Searchable library with series/sector filters and click-to-play embeds |
| `/startupdna/founders/` | Directory of every guest |
| `/startupdna/founders/<slug>.html` | Bio, company, DNA traits, quotes, episode |
| `/startupdna/about.html` | Show mission, host, partners |
| `/startupdna/join.html` | Newsletter, guest pitch, partnership |
