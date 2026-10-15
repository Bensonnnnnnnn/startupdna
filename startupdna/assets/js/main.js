/* Startup DNA — shared behaviours: nav, click-to-play video, forms, footer year */
(function () {
  "use strict";

  /* Mobile nav ---------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* Click-to-play YouTube (privacy-enhanced, lazy) ----------------------- */
  function playVideo(box) {
    var id = box.getAttribute("data-yt");
    if (!id || box.querySelector("iframe")) return;
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1";
    iframe.title = "YouTube video player";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    box.appendChild(iframe);
    var btn = box.querySelector(".play");
    if (btn) btn.remove();
  }
  window.SDNA_playVideo = playVideo;

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".video .play");
    if (!btn) return;
    var box = btn.closest(".video");
    if (box) playVideo(box);
  });

  /* Forms ----------------------------------------------------------------
     Works with Netlify Forms (data-netlify) or Formspree (action URL).
     Progressive enhancement: without JS the form posts normally. */
  function serialize(form) {
    var fd = new FormData(form);
    return fd;
  }

  function showSuccess(form, msg) {
    var box = document.createElement("div");
    box.className = "form-success";
    box.setAttribute("role", "status");
    box.textContent = msg;
    form.replaceWith(box);
  }

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      var action = form.getAttribute("action") || "";
      var isNetlify = form.hasAttribute("data-netlify") && /\.netlify\.app$/.test(location.hostname);
      var isPlaceholder = /YOUR_FORM_ID/.test(action) || /join\.html$/.test(action);
      var isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";

      // Local preview / not wired yet: show success without posting.
      if (isLocal || (isPlaceholder && !isNetlify)) {
        e.preventDefault();
        var kind = form.getAttribute("data-form");
        showSuccess(
          form,
          kind === "newsletter"
            ? "You're on the list. (Preview mode: connect Formspree or Netlify Forms to collect real emails.)"
            : kind === "pitch"
            ? "Pitch received. (Preview mode: connect Formspree or Netlify Forms to receive pitches.)"
            : "Thanks. (Preview mode: connect Formspree or Netlify Forms to receive this.)"
        );
        return;
      }

      e.preventDefault();
      var kind = form.getAttribute("data-form");
      var submit = form.querySelector('[type="submit"]');
      if (submit) { submit.disabled = true; submit.dataset.label = submit.textContent; submit.textContent = "Sending…"; }

      var url = isNetlify && isPlaceholder ? window.location.pathname : action;
      var body = serialize(form);
      var opts = { method: "POST", body: body, headers: {} };
      if (!isNetlify) opts.headers["Accept"] = "application/json";
      else opts.body = new URLSearchParams(body).toString(), (opts.headers["Content-Type"] = "application/x-www-form-urlencoded");

      fetch(url, opts)
        .then(function (r) {
          if (!r.ok) throw new Error("Request failed: " + r.status);
          var msg =
            kind === "newsletter"
              ? "You're on the list. We'll email you when the next episode drops."
              : kind === "pitch"
              ? "Pitch received. Thank you. We read every one and reply to the ones we can schedule."
              : "Thanks. We'll be in touch shortly.";
          showSuccess(form, msg);
        })
        .catch(function () {
          if (submit) { submit.disabled = false; submit.textContent = submit.dataset.label || "Send"; }
          var note = form.querySelector(".form-error");
          if (!note) {
            note = document.createElement("p");
            note.className = "form-note form-error";
            note.style.color = "#b42318";
            form.appendChild(note);
          }
          note.textContent =
            "Something went wrong sending the form. Please try again, or email us directly via the links in the footer.";
        });
    });
  });

  /* Footer year ---------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
