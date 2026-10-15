/* Startup DNA — episode library: search, filters, inline detail + player, hash routing */
(function () {
  "use strict";
  var data = window.SDNA;
  if (!data) return;

  var grid = document.getElementById("library");
  var empty = document.getElementById("empty");
  var countEl = document.querySelector(".results-bar .count");
  var q = document.getElementById("q");
  var clearBtn = document.querySelector("[data-clear]");

  var state = { q: "", series: "", sector: "", open: null };

  /* --- url state ------------------------------------------------------- */
  var params = new URLSearchParams(location.search);
  if (params.get("series")) state.series = params.get("series");
  if (params.get("sector")) state.sector = params.get("sector");
  if (params.get("q")) state.q = params.get("q");
  if (location.hash.indexOf("#ep-") === 0) state.open = location.hash.slice(4);

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.series) p.set("series", state.series);
    if (state.sector) p.set("sector", state.sector);
    var qs = p.toString();
    var url = location.pathname + (qs ? "?" + qs : "") + (state.open ? "#ep-" + state.open : "");
    history.replaceState(null, "", url);
  }

  /* --- helpers --------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function haystack(ep) {
    return norm([ep.title, ep.hook, ep.guestNames, ep.guestLabel, ep.company, ep.description, ep.series]
      .concat(ep.sectors, ep.tags, ep.takeaways).join(" "));
  }
  var indexed = data.episodes.map(function (ep) { ep._h = haystack(ep); return ep; });

  function matches(ep) {
    if (state.series && ep.series !== state.series) return false;
    if (state.sector && ep.sectors.indexOf(state.sector) === -1) return false;
    if (state.q) {
      var terms = norm(state.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) if (ep._h.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /* --- rendering ------------------------------------------------------- */
  function card(ep) {
    return (
      '<article class="ep-card" id="card-' + ep.id + '">' +
        '<a class="thumb" href="#ep-' + ep.id + '" data-open="' + ep.id + '" aria-label="' + esc(ep.title) + '">' +
          '<img src="' + ep.thumbHd + '" onerror="this.onerror=null;this.src=\'' + ep.thumb + '\'" alt="" loading="lazy">' +
          '<span class="dur">' + esc(ep.duration) + '</span>' +
        '</a>' +
        '<div class="body">' +
          '<div class="series-label">' + esc(ep.series) + '</div>' +
          '<div class="guest">' + esc(ep.guestLabel) + '</div>' +
          '<h3 class="title"><a href="#ep-' + ep.id + '" data-open="' + ep.id + '">' + esc(ep.title) + '</a></h3>' +
          '<p class="desc">' + esc(ep.description) + '</p>' +
          '<div class="meta"><span>' + esc(ep.dateLabel) + '</span><span class="sectors">' +
            ep.sectors.slice(0, 2).map(function (s) { return '<span class="chip-s">' + esc(s) + '</span>'; }).join("") +
          '</span></div>' +
        '</div>' +
      '</article>'
    );
  }

  function detail(ep) {
    var guests = ep.guestLinks.map(function (g) {
      return '<a href="' + g.url + '">' + esc(g.name) + '</a>';
    }).join(" &amp; ");
    return (
      '<section class="ep-detail" id="ep-' + ep.id + '" aria-label="Episode details: ' + esc(ep.title) + '">' +
        '<div class="hd"><div>' +
          '<div class="guest">' + esc(ep.guestLabel) + '</div>' +
          '<h3>' + esc(ep.title) + '</h3>' +
          '<div class="meta"><span>' + esc(ep.series) + '</span><span>' + esc(ep.duration) + '</span><span>' + esc(ep.dateLabel) + '</span><span>' + esc(ep.company) + '</span></div>' +
        '</div><button class="close" type="button" data-close>Close ✕</button></div>' +
        '<div>' +
          '<div class="video" data-yt="' + ep.id + '">' +
            '<img src="' + ep.thumbHd + '" onerror="this.onerror=null;this.src=\'' + ep.thumb + '\'" alt="" loading="lazy">' +
            '<button class="play" type="button" aria-label="Play: ' + esc(ep.title) + '">' +
              '<span class="dur">' + esc(ep.duration) + '</span>' +
              '<span class="icon"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>' +
            '</button>' +
          '</div>' +
          '<p style="margin:14px 0 0;font-size:14px;color:var(--slate)">Guest page' + (ep.guestLinks.length > 1 ? "s" : "") + ': ' + guests + ' · <a href="https://www.youtube.com/watch?v=' + ep.id + '" target="_blank" rel="noopener">Watch on YouTube ↗</a></p>' +
        '</div>' +
        '<div class="notes">' +
          '<p class="eyebrow">Show notes</p>' +
          '<p><em>' + esc(ep.hook) + '</em></p>' +
          '<p>' + esc(ep.description) + '</p>' +
          '<h4 style="margin-top:18px">In this episode</h4>' +
          '<ul class="takeaways">' + ep.takeaways.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>' +
          (ep.links && ep.links.length
            ? '<div class="links">' + ep.links.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>'; }).join("") + '</div>'
            : "") +
          '<div class="sectors" style="margin-top:16px;display:flex;gap:6px;flex-wrap:wrap">' +
            ep.sectors.map(function (s) { return '<button class="chip-s" type="button" data-sector="' + esc(s) + '" style="border:0;cursor:pointer">' + esc(s) + '</button>'; }).join("") +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function render(scrollToOpen) {
    var shown = indexed.filter(matches);
    var html = "";
    var openEp = null;
    shown.forEach(function (ep) {
      if (state.open === ep.id) {
        openEp = ep;
        html += detail(ep);
      } else {
        html += card(ep);
      }
    });
    // If the open episode is filtered out, still show it on top so the deep link works.
    if (state.open && !openEp) {
      var ep = indexed.filter(function (e) { return e.id === state.open; })[0];
      if (ep) { html = detail(ep) + html; openEp = ep; }
    }
    grid.innerHTML = html;
    var total = shown.length + (openEp && shown.indexOf(openEp) === -1 ? 1 : 0);
    empty.hidden = total !== 0;
    countEl.innerHTML = "<strong>" + total + "</strong> " + (total === 1 ? "episode" : "episodes") +
      (state.q || state.series || state.sector ? ' · <a href="#" data-reset>Reset</a>' : "");
    if (clearBtn) clearBtn.hidden = !state.q;

    if (scrollToOpen && openEp) {
      var el = document.getElementById("ep-" + openEp.id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        var closeBtn = el.querySelector("[data-close]");
        if (closeBtn) closeBtn.focus({ preventScroll: true });
      }
    }
    syncUrl();
  }

  /* --- chips ----------------------------------------------------------- */
  function setChips(group, value) {
    document.querySelectorAll('[data-filter="' + group + '"] .chip').forEach(function (c) {
      c.setAttribute("aria-pressed", String((c.getAttribute("data-value") || "") === (value || "")));
    });
  }
  document.querySelectorAll(".filter-group").forEach(function (g) {
    var key = g.getAttribute("data-filter");
    g.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      state[key] = chip.getAttribute("data-value") || "";
      setChips(key, state[key]);
      render(false);
    });
  });

  /* --- search ---------------------------------------------------------- */
  var t;
  q.value = state.q;
  q.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(function () { state.q = q.value.trim(); render(false); }, 120);
  });
  if (clearBtn) clearBtn.addEventListener("click", function () { q.value = ""; state.q = ""; render(false); q.focus(); });

  /* --- open / close / reset -------------------------------------------- */
  grid.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) {
      e.preventDefault();
      state.open = open.getAttribute("data-open");
      render(true);
      return;
    }
    if (e.target.closest("[data-close]")) {
      var id = state.open;
      state.open = null;
      render(false);
      var back = document.getElementById("card-" + id);
      if (back) { back.scrollIntoView({ behavior: "smooth", block: "center" }); back.querySelector(".title a").focus({ preventScroll: true }); }
      return;
    }
    var sec = e.target.closest("[data-sector]");
    if (sec) {
      state.sector = sec.getAttribute("data-sector");
      setChips("sector", state.sector);
      state.open = null;
      render(false);
      window.scrollTo({ top: document.querySelector(".library-controls").offsetTop - 90, behavior: "smooth" });
    }
  });
  countEl.addEventListener("click", function (e) {
    if (e.target.closest("[data-reset]")) {
      e.preventDefault();
      state.q = ""; state.series = ""; state.sector = ""; q.value = "";
      setChips("series", ""); setChips("sector", "");
      render(false);
    }
  });
  window.addEventListener("hashchange", function () {
    state.open = location.hash.indexOf("#ep-") === 0 ? location.hash.slice(4) : null;
    render(true);
  });

  /* --- init ------------------------------------------------------------ */
  setChips("series", state.series);
  setChips("sector", state.sector);
  render(!!state.open);
})();
