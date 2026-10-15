#!/usr/bin/env node
/*
  Startup DNA static site builder (zero dependencies).

  Reads:   data/site.json, data/episodes.json, data/founders.json
  Writes:  startupdna/index.html, startupdna/episodes.html, startupdna/about.html,
           startupdna/join.html, startupdna/founders/*.html
           (served at /startupdna/)

  Run:     node build.js
*/

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const BASE = "/startupdna/";
const OUT = path.join(ROOT, "startupdna");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const site = read("data/site.json");
const episodes = read("data/episodes.json").sort((a, b) => (a.published < b.published ? 1 : -1));
const founders = read("data/founders.json");
const founderBySlug = Object.fromEntries(founders.map((f) => [f.slug, f]));
const episodeById = Object.fromEntries(episodes.map((e) => [e.id, e]));

/* ----------------------------------------------------------------------- */
/* helpers                                                                 */
/* ----------------------------------------------------------------------- */

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

const thumb = (id, q = "hqdefault") => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
const thumbImg = (id, alt, extraAttrs = "") =>
  `<img src="${thumb(id, "maxresdefault")}" onerror="this.onerror=null;this.src='${thumb(id)}'" alt="${esc(alt)}" loading="lazy" ${extraAttrs}>`;

const epUrl = (root, ep) => `${root}episodes.html#ep-${ep.id}`;
const founderUrl = (root, f) => `${root}founders/${f.slug}.html`;

const guestNames = (ep) => ep.guests.map((g) => founderBySlug[g]?.name || g).join(" & ");

const sectorsAll = [...new Set(episodes.flatMap((e) => e.sectors))].sort();
const seriesAll = [...new Set(episodes.map((e) => e.series))];

const icons = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.4 20.4h-3.5v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6a3.7 3.7 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zM7.1 20.4H3.6V9h3.5v11.4zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.5c0 1 .8 1.8 1.8 1.8h20.4c1 0 1.8-.8 1.8-1.8V1.7C24 .8 23.2 0 22.2 0z"/></svg>`,
  rss: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="19" r="2.5"/><path d="M3 10a11 11 0 0 1 11 11h-3a8 8 0 0 0-8-8v-3zm0-7a18 18 0 0 1 18 18h-3A15 15 0 0 0 3 6V3z"/></svg>`,
};

/* ----------------------------------------------------------------------- */
/* layout                                                                  */
/* ----------------------------------------------------------------------- */

const logoMark = (root, { className = "logo", size = 52, alt = "" } = {}) =>
  `<img class="${className}" src="${root}assets/img/logo.png" alt="${esc(alt)}" width="${size}" height="${size}">`;

function header(root, active) {
  const link = (href, label, key) =>
    `<a href="${root}${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${root}" aria-label="${esc(site.name)} home">
      ${logoMark(root)}
      <span class="brand-word">Startup DNA<small>Founder stories · Taipei</small></span>
    </a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav" aria-label="Open menu">${icons.menu}</button>
    <nav class="nav" id="nav" aria-label="Primary">
      ${link("episodes.html", "Episodes", "episodes")}
      ${link("founders/index.html", "Founders", "founders")}
      ${link("about.html", "About", "about")}
      ${link("join.html", "Join", "join")}
      <a class="btn btn-primary" href="${site.social.youtube}?sub_confirmation=1" target="_blank" rel="noopener">${icons.youtube} Subscribe</a>
    </nav>
  </div>
</header>`;
}

function footer(root) {
  return `
<footer class="site-footer">
  <div class="wrap">
    <div class="top">
      <div>
        <a class="brand" href="${root}">
          ${logoMark(root)}
          <span class="brand-word">Startup DNA<small>Founder stories · Taipei</small></span>
        </a>
        <p>${esc(site.tagline)} A founder-interview podcast from Taipei, Taiwan, exploring the makings of a founder.</p>
        <div class="social-row">
          <a href="${site.social.youtube}" target="_blank" rel="noopener">${icons.youtube} YouTube</a>
          <a href="${site.social.facebook}" target="_blank" rel="noopener">${icons.facebook} Facebook</a>
          <a href="${site.social.instagram}" target="_blank" rel="noopener">${icons.instagram} Instagram</a>
        </div>
      </div>
      <div>
        <h4>Watch</h4>
        <ul>
          <li><a href="${root}episodes.html">All episodes</a></li>
          <li><a href="${root}episodes.html?series=${encodeURIComponent("Founder Stories")}">Founder Stories</a></li>
          <li><a href="${root}episodes.html?series=${encodeURIComponent("InnoVEX 2026")}">InnoVEX 2026 series</a></li>
          <li><a href="https://www.youtube.com/feeds/videos.xml?channel_id=${site.social.youtubeChannelId}" target="_blank" rel="noopener">RSS feed</a></li>
        </ul>
      </div>
      <div>
        <h4>Meet</h4>
        <ul>
          <li><a href="${root}founders/index.html">Founder directory</a></li>
          <li><a href="${root}about.html">About the show</a></li>
          <li><a href="${root}about.html#host">The host</a></li>
          <li><a href="${root}about.html#partners">Partners</a></li>
        </ul>
      </div>
      <div>
        <h4>Join</h4>
        <ul>
          <li><a href="${root}join.html#newsletter">Newsletter</a></li>
          <li><a href="${root}join.html#pitch">Pitch yourself as a guest</a></li>
          <li><a href="${root}join.html#partner">Partner with us</a></li>
        </ul>
      </div>
    </div>
    <div class="bottom">
      <span>© <span data-year></span> ${esc(site.name)}. ${esc(site.location)}.</span>
      <span>Episode artwork © Startup DNA. Company facts are drawn from public sources and may change.</span>
    </div>
  </div>
</footer>`;
}

function layout({ title, description, root, active, body, bodyClass = "", extraHead = "", scripts = [] }) {
  const fullTitle = title ? `${title} · ${site.name}` : `${site.name} · ${site.tagline}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${thumb(episodes[0].id, "maxresdefault")}">
<meta name="theme-color" content="#3036FC">
<link rel="icon" href="${root}assets/img/favicon.png" type="image/png" sizes="32x32">
<link rel="icon" href="${root}assets/img/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}assets/css/style.css">
${extraHead}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
${header(root, active)}
<main id="main">
${body}
</main>
${footer(root)}
<script src="${root}assets/js/main.js" defer></script>
${scripts.map((s) => `<script src="${root}${s}" defer></script>`).join("\n")}
</body>
</html>
`;
}

/* ----------------------------------------------------------------------- */
/* components                                                              */
/* ----------------------------------------------------------------------- */

function video(ep, { hero = false, root = "" } = {}) {
  return `
<div class="video${hero ? " hero-video" : ""}" data-yt="${ep.id}">
  ${thumbImg(ep.id, `${guestNames(ep)} on Startup DNA: ${ep.title}`, hero ? 'loading="eager"' : "")}
  <button class="play" type="button" aria-label="Play: ${esc(ep.title)}">
    <span class="dur">${esc(ep.duration)}</span>
    <span class="icon">${icons.play}</span>
  </button>
</div>`;
}

function epCard(ep, root) {
  return `
<article class="ep-card" id="card-${ep.id}">
  <a class="thumb" href="${epUrl(root, ep)}" aria-label="${esc(ep.title)}">
    ${thumbImg(ep.id, "")}
    <span class="dur">${esc(ep.duration)}</span>
  </a>
  <div class="body">
    <div class="series-label">${esc(ep.series)}</div>
    <div class="guest">${esc(ep.guestLabel)}</div>
    <h3 class="title"><a href="${epUrl(root, ep)}">${esc(ep.title)}</a></h3>
    <p class="desc">${esc(ep.description)}</p>
    <div class="meta">
      <span>${fmtDate(ep.published)}</span>
      <span class="sectors">${ep.sectors.slice(0, 2).map((s) => `<span class="chip-s">${esc(s)}</span>`).join("")}</span>
    </div>
  </div>
</article>`;
}

function founderCard(f, root) {
  return `
<a class="founder-card" href="${founderUrl(root, f)}">
  <div class="photo"><img src="${thumb(f.episode, "maxresdefault")}" onerror="this.onerror=null;this.src='${thumb(f.episode)}'" alt="" style="object-position:${esc(f.photoPosition || "80% center")}" loading="lazy"></div>
  <div class="inner">
    <div class="name">${esc(f.name)}</div>
    <div class="co">${esc(f.company)}</div>
    <div class="role">${esc(f.title)}</div>
    <div class="traits">${f.traits.slice(0, 2).map((t) => `<span class="trait">${esc(t)}</span>`).join("")}</div>
  </div>
</a>`;
}

function pageHead(root, { eyebrow, titleHtml, lede }) {
  return `
<section class="page-head on-blue">
  <img class="helix" src="${root}assets/img/helix.svg" alt="" aria-hidden="true">
  <div class="wrap page-head-inner">
    <p class="eyebrow on-dark">${eyebrow}</p>
    <h1>${titleHtml}</h1>
    <p class="lede">${lede}</p>
  </div>
</section>`;
}

function newsletterInline(root, dark = true) {
  return `
<form class="form-inline" method="POST" action="${root}join.html" data-form="newsletter" name="newsletter" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="newsletter">
  <p class="hp"><label>Don't fill this out: <input name="bot-field"></label></p>
  <label class="visually-hidden" for="nl-email">Email address</label>
  <input id="nl-email" type="email" name="email" placeholder="you@example.com" required autocomplete="email">
  <button class="btn ${dark ? "btn-primary" : "btn-ink"}" type="submit">Get new episodes</button>
</form>
<p class="form-note">One email per episode. No spam. Unsubscribe any time.</p>`;
}

/* ----------------------------------------------------------------------- */
/* pages                                                                   */
/* ----------------------------------------------------------------------- */

function pageIndex() {
  const root = BASE;
  const latest = episodes[0];
  const recent = episodes.slice(1, 4);
  const featuredFounders = ["john-fan", "camila-saenz", "daniel-yu", "jac-hsieh"].map((s) => founderBySlug[s]);

  const body = `
<section class="hero on-blue">
  <img class="helix" src="assets/img/helix.svg" alt="" aria-hidden="true">
  <div class="wrap">
    <div>
      <h1>We admire startups.<span class="accent">But we love founders.</span></h1>
      <p class="lede">For their vision, their grit, their unshakable will. Reaching beyond the pitch decks and demos, these are the founder's stories. Are they born, or are they made?</p>
      <div class="actions">
        <a class="btn btn-primary" href="${root}episodes.html">${icons.play} Watch the episodes</a>
        <a class="btn btn-ghost" href="${root}founders/">Meet the founders</a>
      </div>
      <div class="stats" aria-label="Show at a glance">
        <div class="stat"><div class="n">${episodes.length}</div><div class="l">Episodes</div></div>
        <div class="stat"><div class="n">${founders.length}</div><div class="l">Founders & builders</div></div>
        <div class="stat"><div class="n">${seriesAll.length}</div><div class="l">Series</div></div>
      </div>
    </div>
    <div>
      <p class="eyebrow on-dark">Latest episode · ${fmtDate(latest.published)}</p>
      ${video(latest, { hero: true })}
      <p style="margin:14px 0 0;font-size:15px;color:rgba(255,255,255,.85)"><strong style="color:var(--orange)">${esc(latest.guestLabel)}</strong> · ${esc(latest.title)} · <a href="${epUrl(root, latest)}">Show notes →</a></p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Recent</p>
        <h2>Fresh from the studio</h2>
      </div>
      <a class="more" href="${root}episodes.html">All ${episodes.length} episodes</a>
    </div>
    <div class="grid grid-3">
      ${recent.map((e) => epCard(e, root)).join("")}
    </div>
  </div>
</section>

<section class="section on-ink">
  <div class="wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow on-dark">The directory</p>
        <h2>Meet the founders</h2>
      </div>
      <a class="more" href="${root}founders/">Browse all ${founders.length}</a>
    </div>
    <div class="grid grid-4">
      ${featuredFounders.map((f) => founderCard(f, root)).join("")}
    </div>
    <p style="margin:26px 0 0;color:rgba(255,255,255,.72);max-width:64ch">Every guest gets a page: who they are, what they're building, the numbers behind it, and the lines worth remembering. Something a social feed never gives you.</p>
  </div>
</section>

<section class="section on-blue">
  <div class="wrap manifesto">
    <div>
      <p class="eyebrow on-dark">Why we do this</p>
      <h2 style="color:#fff">What is Startup DNA?</h2>
      <p class="body">${esc(site.manifesto[2])} ${esc(site.manifesto[3])}</p>
      <p class="body">We call it sDNA. The show launched in 2026 from Taipei and in its first season became an official media partner of InnoVEX at COMPUTEX, the largest startup showcase in Asia's hardware capital.</p>
      <a class="btn btn-ghost" href="${root}about.html">About the show</a>
    </div>
    <div class="lines">
      <p>${esc(site.manifesto[0])}</p>
      <p>${esc(site.manifesto[1])}</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow">Overheard on the show</p>
    <div class="quotes">
      ${site.pullQuotes
        .map(
          (q) => `<div class="quote"><blockquote>${esc(q.text)}</blockquote><cite>${esc(q.source)} · <a href="${site.social.facebook}" target="_blank" rel="noopener">Watch the clips</a></cite></div>`
        )
        .join("")}
    </div>
  </div>
</section>

<section class="section-tight on-white" id="partners">
  <div class="wrap">
    <p class="eyebrow">Partners & sponsors</p>
    <div class="partners">
      ${site.partners
        .map((p) => `<a class="partner" href="${p.url}" target="_blank" rel="noopener"><strong>${esc(p.name)}</strong><span>${esc(p.role)}</span></a>`)
        .join("")}
    </div>
  </div>
</section>

<section class="section cta-band on-ink">
  <div class="wrap">
    <div>
      <p class="eyebrow on-dark">Stay in the loop</p>
      <h2>New episode?<span class="accent">You'll know first.</span></h2>
    </div>
    <div>
      ${newsletterInline(root)}
      <p style="margin-top:18px"><a href="${root}join.html#pitch" style="font-weight:600">Building something? Pitch yourself as a guest →</a></p>
    </div>
  </div>
</section>`;

  return layout({ root, active: "home", body, bodyClass: "page-home" });
}

function pageEpisodes() {
  const root = BASE;
  const data = {
    episodes: episodes.map((e) => ({
      ...e,
      guestNames: guestNames(e),
      guestLinks: e.guests.map((g) => ({ name: founderBySlug[g]?.name || g, url: `${BASE}founders/${g}.html` })),
      dateLabel: fmtDate(e.published),
      thumb: thumb(e.id),
      thumbHd: thumb(e.id, "maxresdefault"),
    })),
    sectors: sectorsAll,
    series: seriesAll,
  };

  const body = `
${pageHead(root, {
    eyebrow: "The library",
    titleHtml: `Every<span class="accent">episode.</span>`,
    lede: "Search by founder, company or topic. Filter by series or sector. Play right here, read the show notes, and jump to the founder's page.",
  })}

<section class="section-tight">
  <div class="wrap">
    <div class="library-controls">
      <div class="search" role="search">
        ${icons.search}
        <label class="visually-hidden" for="q">Search episodes</label>
        <input id="q" type="search" placeholder="Search founders, companies, topics… e.g. “robotics”, “NVIDIA”, “Guatemala”" autocomplete="off">
        <button type="button" data-clear hidden>Clear</button>
      </div>
      <div class="filter-groups">
        <div class="filter-group" data-filter="series">
          <span class="label">Series</span>
          <button class="chip" type="button" data-value="" aria-pressed="true">All</button>
          ${seriesAll.map((s) => `<button class="chip" type="button" data-value="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join("")}
        </div>
        <div class="filter-group" data-filter="sector">
          <span class="label">Sector</span>
          <button class="chip" type="button" data-value="" aria-pressed="true">All</button>
          ${sectorsAll.map((s) => `<button class="chip" type="button" data-value="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join("")}
        </div>
      </div>
    </div>

    <div class="results-bar">
      <span class="count" aria-live="polite"><strong>${episodes.length}</strong> episodes</span>
      <span class="total">Sorted newest first</span>
    </div>

    <div class="grid grid-3" id="library" aria-live="polite">
      <noscript>
        ${episodes.map((e) => epCard(e, root)).join("")}
      </noscript>
    </div>
    <div class="empty" id="empty" hidden>
      <p><strong>No episodes match that yet.</strong></p>
      <p>Try a broader search, or <a href="${root}join.html#pitch">pitch us the founder you want to hear from</a>.</p>
    </div>
  </div>
</section>

<section class="section cta-band on-ink">
  <div class="wrap">
    <div>
      <p class="eyebrow on-dark">Never miss one</p>
      <h2>Get the next<span class="accent">episode by email.</span></h2>
    </div>
    <div>${newsletterInline(root)}</div>
  </div>
</section>`;

  const extraHead = `<script>window.SDNA = ${JSON.stringify(data).replace(/</g, "\\u003c")};</script>`;
  return layout({
    title: "Episodes",
    description: "Watch every Startup DNA episode. Search by founder, company or topic and read the show notes.",
    root,
    active: "episodes",
    body,
    extraHead,
    scripts: ["assets/js/library.js"],
  });
}

function pageFoundersIndex() {
  const root = BASE;
  const body = `
${pageHead(root, {
    eyebrow: "The directory",
    titleHtml: `The<span class="accent">founders.</span>`,
    lede: "Every guest who has sat down with Startup DNA. Who they are, what they're building, the facts behind the story, and the lines worth remembering.",
  })}

<section class="section">
  <div class="wrap">
    <div class="grid grid-4">
      ${founders.map((f) => founderCard(f, root)).join("")}
    </div>
  </div>
</section>

<section class="section cta-band on-ink">
  <div class="wrap">
    <div>
      <p class="eyebrow on-dark">Your turn</p>
      <h2>Building something<span class="accent">worth telling?</span></h2>
    </div>
    <div>
      <a class="btn btn-primary" href="${root}join.html#pitch">Pitch yourself as a guest</a>
    </div>
  </div>
</section>`;

  return layout({
    title: "Founders",
    description: "Meet every founder featured on Startup DNA: bios, companies, key facts and quotes.",
    root,
    active: "founders",
    body,
  });
}

function pageFounder(f) {
  const root = BASE;
  const ep = episodeById[f.episode];
  const others = founders.filter((x) => x.slug !== f.slug && x.episode !== f.episode).slice(0, 4);
  const coGuests = founders.filter((x) => x.slug !== f.slug && x.episode === f.episode);

  const quotes = f.quotes || [];
  const body = `
<section class="founder-hero on-blue">
  <img class="helix" src="${root}assets/img/helix.svg" alt="" aria-hidden="true">
  <div class="wrap" style="position:relative">
    <div class="portrait">
      <img src="${thumb(f.episode, "maxresdefault")}" onerror="this.onerror=null;this.src='${thumb(f.episode)}'" alt="${esc(f.name)}" style="object-position:${esc(f.photoPosition || "80% center")}">
    </div>
    <div>
      <p class="breadcrumb"><a href="${root}founders/index.html">Founders</a> / ${esc(f.company)}</p>
      <h1>${esc(f.name)}</h1>
      <div class="co">${esc(f.company)}</div>
      <div class="role">${esc(f.title)}${f.chineseName ? ` · ${esc(f.chineseName)}` : ""} · ${esc(f.location)}</div>
      <p class="oneliner">${esc(f.oneLiner)}</p>
      <div class="traits">${f.traits.map((t) => `<span class="trait">${esc(t)}</span>`).join("")}</div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap founder-body">
    <div class="prose">
      <p class="eyebrow">The founder</p>
      <h2>Who is ${esc(f.name.replace(/^Dr\.\s*/, ""))}?</h2>
      <p>${esc(f.bio)}</p>

      ${quotes[0] ? `<div class="pullquote-lg"><blockquote>${esc(quotes[0].text)}</blockquote><cite>${esc(f.name)} · ${esc(quotes[0].source)}</cite></div>` : ""}

      <p class="eyebrow" style="margin-top:36px">The company</p>
      <h3>${esc(f.company)}</h3>
      <p>${esc(f.companyBlurb)}</p>

      ${quotes[1] ? `<div class="pullquote-lg"><blockquote>${esc(quotes[1].text)}</blockquote><cite>${esc(f.name)} · ${esc(quotes[1].source)}</cite></div>` : ""}

      ${
        ep
          ? `
      <p class="eyebrow" style="margin-top:36px">The episode</p>
      <h3>${esc(ep.title)}</h3>
      <p style="color:var(--slate)">${esc(ep.series)} · ${esc(ep.duration)} · ${fmtDate(ep.published)}${coGuests.length ? ` · with ${coGuests.map((c) => `<a href="${founderUrl(root, c)}">${esc(c.name)}</a>`).join(", ")}` : ""}</p>
      ${video(ep, { root })}
      <p style="margin-top:14px"><em>${esc(ep.hook)}</em></p>
      <ul class="takeaways" style="padding-left:20px">${ep.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p><a href="${epUrl(root, ep)}" style="font-weight:600">Full show notes →</a></p>`
          : ""
      }
    </div>

    <aside>
      <div class="card">
        <h4>At a glance</h4>
        <dl class="facts">
          ${f.facts.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join("")}
        </dl>
      </div>
      <div class="card">
        <h4>Links</h4>
        <ul class="link-list">
          <li><a href="${f.companyUrl}" target="_blank" rel="noopener">${esc(f.company)}</a></li>
          ${(f.links || [])
            .filter((l) => l.url.replace(/\/$/, "") !== f.companyUrl.replace(/\/$/, ""))
            .map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`)
            .join("")}
          ${ep ? `<li><a href="https://www.youtube.com/watch?v=${ep.id}" target="_blank" rel="noopener">Watch on YouTube</a></li>` : ""}
        </ul>
      </div>
      <div class="card" style="background:var(--blue);color:#fff;border:0">
        <h4 style="color:rgba(255,255,255,.75)">Know a founder like this?</h4>
        <p style="margin:0 0 14px;font-size:15px">We're always looking for the next story.</p>
        <a class="btn btn-primary" href="${root}join.html#pitch" style="font-size:15px;padding:10px 18px">Pitch a guest</a>
      </div>
    </aside>
  </div>
</section>

<section class="section on-ink">
  <div class="wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow on-dark">Keep exploring</p>
        <h2>More founders</h2>
      </div>
      <a class="more" href="${root}founders/index.html">All ${founders.length}</a>
    </div>
    <div class="grid grid-4">${others.map((o) => founderCard(o, root)).join("")}</div>
  </div>
</section>`;

  return layout({
    title: `${f.name} · ${f.company}`,
    description: f.oneLiner,
    root,
    active: "founders",
    body,
  });
}

function pageAbout() {
  const root = BASE;
  const h = site.host;
  const body = `
${pageHead(root, {
    eyebrow: "About",
    titleHtml: `The makings<span class="accent">of a founder.</span>`,
    lede: "Startup DNA is a founder-interview podcast from Taipei. We call it sDNA.",
  })}

<section class="section">
  <div class="wrap about-grid">
    <div>
      <p class="eyebrow">The show</p>
      <h2>Beyond the pitch deck</h2>
      ${site.manifesto.map((m) => `<p style="font-size:17px">${esc(m)}</p>`).join("")}
      <p style="font-size:17px">Each conversation runs 30 to 45 minutes and is recorded in Taipei, with shorter on-the-floor interviews filmed at events like InnoVEX. We publish on YouTube, with clips on Facebook and Instagram.</p>
      <div class="social-row" style="margin-top:18px">
        <a href="${site.social.youtube}" target="_blank" rel="noopener">${icons.youtube} YouTube</a>
        <a href="${site.social.facebook}" target="_blank" rel="noopener">${icons.facebook} Facebook</a>
        <a href="${site.social.instagram}" target="_blank" rel="noopener">${icons.instagram} Instagram</a>
        <a href="https://www.youtube.com/feeds/videos.xml?channel_id=${site.social.youtubeChannelId}" target="_blank" rel="noopener">${icons.rss} RSS</a>
      </div>
    </div>
    <div class="host-card" id="host">
      <div class="role">${esc(h.role)}</div>
      <div class="name">${esc(h.name)}</div>
      <p style="margin:16px 0 18px;color:rgba(255,255,255,.9)">${esc(h.bio)}</p>
      <a class="btn btn-ghost" href="${h.linkedin}" target="_blank" rel="noopener">${icons.linkedin} Connect on LinkedIn</a>
    </div>
  </div>
</section>

<section class="section on-white">
  <div class="wrap">
    <p class="eyebrow">How an episode happens</p>
    <h2>From intro to upload</h2>
    <div class="steps" style="margin-top:28px">
      <div class="step"><h4>The pitch</h4><p>A founder, investor or operator reaches out, or we find them on a show floor. We look for a real story, not a product launch.</p></div>
      <div class="step"><h4>The conversation</h4><p>Recorded in Taipei at The Studio. We ask about the origin, the hard turns, the people, and what the founder believes that others don't.</p></div>
      <div class="step"><h4>The story</h4><p>Edited into a full episode plus clips. Then it lives here, with show notes, a founder profile, and the facts behind the headlines.</p></div>
    </div>
  </div>
</section>

<section class="section" id="partners">
  <div class="wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Partners & sponsors</p>
        <h2>Who backs the show</h2>
      </div>
      <a class="more" href="${root}join.html#partner">Partner with us</a>
    </div>
    <div class="partners">
      ${site.partners
        .map((p) => `<a class="partner" href="${p.url}" target="_blank" rel="noopener"><strong>${esc(p.name)}</strong><span>${esc(p.role)}</span></a>`)
        .join("")}
    </div>
  </div>
</section>

<section class="section cta-band on-ink">
  <div class="wrap">
    <div>
      <p class="eyebrow on-dark">Stay in the loop</p>
      <h2>New episode?<span class="accent">You'll know first.</span></h2>
    </div>
    <div>${newsletterInline(root)}</div>
  </div>
</section>`;

  return layout({
    title: "About",
    description: "About Startup DNA, the founder-interview podcast from Taipei, and its host Anthony Lin.",
    root,
    active: "about",
    body,
  });
}

function pageJoin() {
  const root = BASE;
  const formspree = site.forms.formspreeEndpoint;
  const body = `
${pageHead(root, {
    eyebrow: "Join",
    titleHtml: `Be part<span class="accent">of the story.</span>`,
    lede: "Get new episodes by email, pitch yourself (or a founder you admire) as a guest, or partner with the show.",
  })}

<section class="section">
  <div class="wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:start" id="join-grid">
    <div class="card" id="newsletter" style="scroll-margin-top:90px">
      <p class="eyebrow">Newsletter</p>
      <h3>New episodes, in your inbox</h3>
      <p style="color:var(--slate)">One email when an episode drops, with the show notes and the founder's page. Nothing else.</p>
      <form class="form" method="POST" action="${formspree}" data-form="newsletter" name="newsletter" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="newsletter">
        <p class="hp"><label>Don't fill this out: <input name="bot-field"></label></p>
        <div class="field">
          <label for="j-email">Email</label>
          <input id="j-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="j-name">First name <span style="color:var(--slate);font-weight:400">(optional)</span></label>
          <input id="j-name" type="text" name="name" autocomplete="given-name">
        </div>
        <button class="btn btn-ink" type="submit">Subscribe</button>
        <p class="form-note">By subscribing you agree to receive episode emails from Startup DNA. Unsubscribe any time.</p>
      </form>
    </div>

    <div class="card" id="pitch" style="scroll-margin-top:90px">
      <p class="eyebrow">Be a guest</p>
      <h3>Pitch yourself as a guest</h3>
      <p style="color:var(--slate)">We look for founders, builders and investors with a real story: the origin, the hard turns, the conviction. Stage and sector don't matter. Taiwan connection is a plus, not a requirement.</p>
      <form class="form" method="POST" action="${formspree}" data-form="pitch" name="guest-pitch" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="guest-pitch">
        <p class="hp"><label>Don't fill this out: <input name="bot-field"></label></p>
        <div class="form-row">
          <div class="field">
            <label for="p-name">Your name</label>
            <input id="p-name" type="text" name="name" required autocomplete="name">
          </div>
          <div class="field">
            <label for="p-email">Email</label>
            <input id="p-email" type="email" name="email" required autocomplete="email">
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="p-company">Company</label>
            <input id="p-company" type="text" name="company" required>
          </div>
          <div class="field">
            <label for="p-role">Your role</label>
            <input id="p-role" type="text" name="role" placeholder="Founder, CEO, CTO, investor…" required>
          </div>
        </div>
        <div class="field">
          <label for="p-url">Company website or LinkedIn</label>
          <input id="p-url" type="url" name="url" placeholder="https://">
        </div>
        <div class="field">
          <label for="p-who">Who are you pitching?</label>
          <select id="p-who" name="who">
            <option>Myself</option>
            <option>A founder I know</option>
            <option>A client / portfolio founder</option>
          </select>
        </div>
        <div class="field">
          <label for="p-story">The story in a few lines</label>
          <textarea id="p-story" name="story" rows="5" required placeholder="What are you building, what's the hardest thing you've been through, and why now?"></textarea>
          <span class="hint">Skip the product pitch. Tell us the moment things almost broke.</span>
        </div>
        <button class="btn btn-primary" type="submit">Send the pitch</button>
        <p class="form-note">We read every pitch and reply to the ones we can schedule.</p>
      </form>
    </div>
  </div>
</section>

<section class="section on-white" id="partner" style="scroll-margin-top:90px">
  <div class="wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:center" id="partner-grid">
    <div>
      <p class="eyebrow">Partners & sponsors</p>
      <h2>Put your name next to the founders</h2>
      <p style="font-size:17px">Startup DNA is an official media partner of InnoVEX at COMPUTEX and is sponsored by PicCollage and The Studio. If you run an event, accelerator, fund or venue and want to reach founders and the people who back them, we'd like to talk.</p>
      <ul style="font-size:16px;color:var(--slate)">
        <li>Event media partnership: on-site founder interviews, like our InnoVEX 2026 series</li>
        <li>Episode sponsorship: a short, honest read at the top of the show</li>
        <li>Venue partnership: host a recording</li>
      </ul>
    </div>
    <div class="card">
      <form class="form" method="POST" action="${formspree}" data-form="partner" name="partner" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="partner">
        <p class="hp"><label>Don't fill this out: <input name="bot-field"></label></p>
        <div class="form-row">
          <div class="field"><label for="pa-name">Name</label><input id="pa-name" type="text" name="name" required></div>
          <div class="field"><label for="pa-email">Email</label><input id="pa-email" type="email" name="email" required></div>
        </div>
        <div class="field"><label for="pa-org">Organisation</label><input id="pa-org" type="text" name="organisation" required></div>
        <div class="field"><label for="pa-msg">What do you have in mind?</label><textarea id="pa-msg" name="message" rows="4" required></textarea></div>
        <button class="btn btn-ink" type="submit">Start the conversation</button>
      </form>
    </div>
  </div>
</section>
<style>
  @media (max-width: 900px) { #join-grid, #partner-grid { grid-template-columns: 1fr !important; } }
</style>`;

  return layout({
    title: "Join",
    description: "Subscribe to Startup DNA by email, pitch yourself as a guest, or partner with the show.",
    root,
    active: "join",
    body,
  });
}

/* ----------------------------------------------------------------------- */
/* write                                                                   */
/* ----------------------------------------------------------------------- */

function write(rel, html) {
  const out = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log("wrote", path.posix.join("startupdna", rel));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

copyDir(path.join(ROOT, "assets"), path.join(OUT, "assets"));
write("index.html", pageIndex());
write("episodes.html", pageEpisodes());
write("about.html", pageAbout());
write("join.html", pageJoin());
write("founders/index.html", pageFoundersIndex());
for (const f of founders) write(`founders/${f.slug}.html`, pageFounder(f));

const founderDir = path.join(OUT, "founders");
for (const file of fs.readdirSync(founderDir)) {
  if (file === "index.html" || !file.endsWith(".html")) continue;
  const slug = file.replace(/\.html$/, "");
  if (!founderBySlug[slug]) {
    fs.unlinkSync(path.join(founderDir, file));
    console.log("removed stale", `startupdna/founders/${file}`);
  }
}

fs.writeFileSync(
  path.join(ROOT, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${BASE}">
<link rel="canonical" href="${BASE}">
<title>Startup DNA</title>
<script>location.replace(${JSON.stringify(BASE)});</script>
</head>
<body>
<p><a href="${BASE}">Continue to Startup DNA</a></p>
</body>
</html>
`
);

console.log(`\nBuilt ${episodes.length} episodes, ${founders.length} founder pages at ${BASE}`);
