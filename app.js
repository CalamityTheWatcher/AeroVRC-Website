/* ============================================================
   AeroVRC website behaviour
   1. Drifting azure sparkle field  (mirrors the app's animated
      page background — Draw-PageBackground)
   2. Download buttons + live version/changelog from GitHub
   The repo is configured once, in index.html: window.AEROVRC_REPO
   ============================================================ */
(function () {
  "use strict";

  /* -------------------------------------------------------- *
   * 0. MOTION — scroll reveal, staggered groups, nav shrink
   * -------------------------------------------------------- */
  (function motion() {
    var root = document.documentElement;
    root.classList.add("js");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Children of a [data-stagger] container become reveal targets with an
    // incremental delay, so they cascade in rather than all at once.
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.classList.add("reveal");
        child.style.setProperty("--rd", (i * 80) + "ms");
      });
    });

    var targets = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      targets.forEach(function (el) { io.observe(el); });
    }

    // Nav switches to a solid, elevated look once the page scrolls.
    var nav = document.querySelector(".nav");
    if (nav) {
      var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 12); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  })();

  /* -------------------------------------------------------- *
   * 1. SPARKLE FIELD
   * -------------------------------------------------------- */
  (function sparkles() {
    var canvas = document.getElementById("sparkles");
    if (!canvas) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [];
    var COLORS = ["96,168,255", "130,198,255", "160,180,255"]; // azure spark palette

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(90, Math.max(36, (W * H) / 22000)));
      parts = [];
      for (var i = 0; i < count; i++) parts.push(makeParticle(true));
    }
    function makeParticle(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : H + 6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.12 + Math.random() * 0.55, // drift downward, like the default "azure" style
        s: 1 + Math.round(Math.random() * 2),
        a: 0.09 + Math.random() * 0.34,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      };
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > H + 6 || p.x < -6 || p.x > W + 6) {
          parts[i] = makeParticle(false);
          continue;
        }
        // soft halo behind the larger dots -> gentle glow
        if (p.s >= 3) {
          ctx.fillStyle = "rgba(" + p.c + "," + (p.a * 0.32).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * 1.8, 0, 6.283);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(" + p.c + "," + p.a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s * 0.6, 0, 6.283);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    var raf;
    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        ctx.fillStyle = "rgba(" + p.c + "," + p.a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s * 0.6, 0, 6.283);
        ctx.fill();
      }
    }
    function start() {
      resize();
      if (!W || !H) { requestAnimationFrame(start); return; } // viewport not sized yet — retry
      if (reduce) { drawStatic(); }
      else { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    }
    window.addEventListener("resize", function () { resize(); if (reduce) drawStatic(); });
    window.addEventListener("load", start);
    start();
  })();

  /* -------------------------------------------------------- *
   * 1b. TABBED SCREENSHOT GALLERY — click/keyboard tabs that
   *     swap which app screen is shown.
   * -------------------------------------------------------- */
  (function tabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (root) {
      var btns = Array.prototype.slice.call(root.querySelectorAll("[data-tab-btn]"));
      var panels = Array.prototype.slice.call(root.querySelectorAll("[data-tab-panel]"));
      if (!btns.length) return;

      function activate(id) {
        btns.forEach(function (b) {
          var on = b.getAttribute("data-tab") === id;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
          b.tabIndex = on ? 0 : -1;
        });
        panels.forEach(function (p) {
          p.classList.toggle("is-active", p.getAttribute("data-tab-panel") === id);
        });
      }

      btns.forEach(function (b, i) {
        b.addEventListener("click", function () { activate(b.getAttribute("data-tab")); });
        b.addEventListener("keydown", function (e) {
          var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          var next = btns[(i + dir + btns.length) % btns.length];
          next.focus();
          activate(next.getAttribute("data-tab"));
        });
      });
    });
  })();

  /* -------------------------------------------------------- *
   * 1c. MOBILE NAV — hamburger toggles the links dropdown.
   * -------------------------------------------------------- */
  (function navMenu() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector("[data-nav-toggle]");
    if (!nav || !toggle) return;
    function close() { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll(".nav-links a").forEach(function (a) { a.addEventListener("click", close); });
    document.addEventListener("click", function (e) { if (nav.classList.contains("open") && !nav.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  })();

  /* -------------------------------------------------------- *
   * 2. DOWNLOAD + VERSION + CHANGELOG
   * -------------------------------------------------------- */
  var REPO = (window.AEROVRC_REPO || "").trim();
  var configured = REPO && REPO.indexOf("YOUR_GITHUB_USERNAME") === -1;
  var ASSET = "AeroVRC.exe";
  var downloadURL = configured ? "https://github.com/" + REPO + "/releases/latest/download/" + ASSET : null;
  var releasesPage = configured ? "https://github.com/" + REPO + "/releases" : null;

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  document.querySelectorAll("[data-download]").forEach(function (a) {
    a.setAttribute("href", downloadURL || "#download");
  });

  function setVersion(text) {
    document.querySelectorAll("[data-version]").forEach(function (el) { el.textContent = text; });
  }

  if (!configured) {
    setVersion("Set your GitHub repo in index.html to enable downloads");
    renderChangelog(null, "unconfigured");
    return;
  }

  // Only hit the GitHub API on pages that actually display something from it
  // (version, changelog, download count, or the splash's "what's new" pill).
  if (!document.querySelector("[data-version]") &&
      !document.querySelector("[data-changelog]") &&
      !document.querySelector("[data-changelog-full]") &&
      !document.querySelector("[data-downloads]") &&
      !document.querySelector("[data-latest]")) {
    return;
  }

  fetch("https://api.github.com/repos/" + REPO + "/releases?per_page=100", {
    headers: { Accept: "application/vnd.github+json" }
  })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (all) {
      if (!Array.isArray(all) || all.length === 0) {
        setVersion("No releases published yet");
        setDownloadsError();
        renderChangelog([], "empty");
        renderChangelogFull([], "empty");
        return;
      }
      // GitHub returns releases ordered by created_at (tag creation), which is
      // not the same as publish order. Sort by published_at (newest first) so the
      // most recently published build is always on top.
      var releases = all
        .filter(function (rel) { return rel && !rel.draft; })
        .sort(function (a, b) { return releaseTime(b) - releaseTime(a); });
      if (releases.length === 0) {
        setVersion("No releases published yet");
        setDownloadsError();
        renderChangelog([], "empty");
        renderChangelogFull([], "empty");
        return;
      }
      var latest = releases[0];
      setVersion(latest.tag_name + " · " + formatDate(latest.published_at));
      setLatest(latest);
      setDownloads(sumDownloads(all));
      renderChangelog(releases.slice(0, 5), "ok");
      renderChangelogFull(releases, "ok");
    })
    .catch(function () {
      setVersion("Latest release on GitHub");
      setDownloadsError();
      renderChangelog(null, "error");
      renderChangelogFull(null, "error");
    });

  /* ---- live numbers pulled from the same releases payload ---- */
  function sumDownloads(releases) {
    var n = 0;
    releases.forEach(function (rel) {
      (rel.assets || []).forEach(function (a) { n += (a.download_count || 0); });
    });
    return n;
  }
  function setDownloads(n) {
    document.querySelectorAll("[data-downloads]").forEach(function (el) {
      el.textContent = (n || 0).toLocaleString();
    });
    // A wrapper stays hidden until a real (>0) number arrives, so we never flash "0".
    document.querySelectorAll("[data-downloads-wrap]").forEach(function (el) {
      if (n && n > 0) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");
    });
  }
  function setDownloadsError() {
    document.querySelectorAll("[data-downloads-wrap]").forEach(function (el) {
      el.setAttribute("hidden", "");
    });
  }
  function setLatest(latest) {
    if (!latest) return;
    document.querySelectorAll("[data-latest-tag]").forEach(function (el) {
      el.textContent = latest.tag_name || "";
    });
  }

  function renderChangelog(releases, state) {
    var box = document.querySelector("[data-changelog]");
    if (!box) return;

    if (state === "unconfigured") {
      box.innerHTML = '<div class="cl-empty">Release notes will appear here once you set ' +
        '<code>window.AEROVRC_REPO</code> in <code>index.html</code> and publish a GitHub Release.</div>';
      return;
    }
    if (state === "error") {
      box.innerHTML = '<div class="cl-empty">Couldn&rsquo;t load release notes right now. ' +
        '<a href="' + releasesPage + '" target="_blank" rel="noopener">View releases on GitHub →</a></div>';
      return;
    }
    if (!releases || releases.length === 0) {
      box.innerHTML = '<div class="cl-empty">No releases yet — the first published GitHub Release will show up here.</div>';
      return;
    }

    box.innerHTML = "";
    releases.forEach(function (rel) {
      var item = document.createElement("div");
      item.className = "cl-item";
      var top = document.createElement("div");
      top.className = "cl-top";
      var tag = document.createElement("span");
      tag.className = "cl-tag";
      tag.textContent = rel.name || rel.tag_name;
      var date = document.createElement("span");
      date.className = "cl-date";
      date.textContent = formatDate(rel.published_at);
      top.appendChild(tag); top.appendChild(date);
      var body = document.createElement("p");
      body.className = "cl-body";
      body.textContent = (rel.body || "No notes for this release.").trim();
      item.appendChild(top); item.appendChild(body);
      box.appendChild(item);
    });
  }

  // Full history for the dedicated changelog page — renders every release and
  // wires the search box to filter them by tag/name/notes.
  function renderChangelogFull(releases, state) {
    var box = document.querySelector("[data-changelog-full]");
    if (!box) return;
    if (state === "error") {
      box.innerHTML = '<div class="cl-empty">Couldn&rsquo;t load release notes right now. ' +
        '<a href="' + releasesPage + '" target="_blank" rel="noopener">View releases on GitHub →</a></div>';
      updateChangelogCount(null);
      return;
    }
    if (!releases || releases.length === 0) {
      box.innerHTML = '<div class="cl-empty">No releases yet — the first published GitHub Release will show up here.</div>';
      updateChangelogCount(0);
      return;
    }
    box.innerHTML = "";
    releases.forEach(function (rel) {
      var item = document.createElement("div");
      item.className = "cl-item";
      item.setAttribute("data-cl-text",
        ((rel.name || "") + " " + (rel.tag_name || "") + " " + (rel.body || "")).toLowerCase());
      var top = document.createElement("div");
      top.className = "cl-top";
      var tag = document.createElement("span");
      tag.className = "cl-tag";
      tag.textContent = rel.name || rel.tag_name;
      var date = document.createElement("span");
      date.className = "cl-date";
      date.textContent = formatDate(rel.published_at);
      top.appendChild(tag); top.appendChild(date);
      var body = document.createElement("p");
      body.className = "cl-body";
      body.textContent = (rel.body || "No notes for this release.").trim();
      item.appendChild(top); item.appendChild(body);
      box.appendChild(item);
    });
    updateChangelogCount(releases.length);
    wireChangelogSearch();
  }

  var clSearchWired = false;
  function wireChangelogSearch() {
    if (clSearchWired) return;
    var input = document.querySelector("[data-changelog-search]");
    var box = document.querySelector("[data-changelog-full]");
    if (!input || !box) return;
    clSearchWired = true;
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      box.querySelectorAll(".cl-item").forEach(function (item) {
        var match = !q || (item.getAttribute("data-cl-text") || "").indexOf(q) > -1;
        item.style.display = match ? "" : "none";
        if (match) shown++;
      });
      var noHits = document.querySelector("[data-changelog-nohits]");
      if (noHits) noHits.hidden = shown !== 0;
    });
  }
  function updateChangelogCount(n) {
    document.querySelectorAll("[data-changelog-count]").forEach(function (el) {
      el.textContent = (n == null) ? "" : (n + (n === 1 ? " release" : " releases"));
    });
  }

  function releaseTime(rel) {
    // Prefer publish time; fall back to creation time so unpublished/odd
    // releases still sort deterministically instead of jumping to the top.
    var iso = rel.published_at || rel.created_at;
    var t = iso ? new Date(iso).getTime() : NaN;
    return isNaN(t) ? 0 : t;
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }

  /* -------------------------------------------------------- *
   * 3. CONTACT FORM — bug reports & feature requests.
   *    Posts to Web3Forms when a key is configured; otherwise
   *    falls back to opening the visitor's own email app.
   * -------------------------------------------------------- */
  (function contactForm() {
    var form = document.querySelector("[data-contact]");
    if (!form) return;
    var statusEl = form.querySelector("[data-form-status]");
    var button = form.querySelector('button[type="submit"]');
    var key = (window.AEROVRC_WEB3FORMS_KEY || "").trim();
    var configured = key && key.indexOf("YOUR_") === -1;
    var EMAIL = "ajordan120906@gmail.com";

    function val(name) { var el = form.elements[name]; return el ? el.value.trim() : ""; }
    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg || "";
      statusEl.className = "form-status" + (kind ? " " + kind : "");
    }
    function setBusy(busy) {
      if (button) { button.disabled = busy; button.textContent = busy ? "Sending…" : "Send message"; }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      // honeypot — a real person can't see or tick this box
      var hp = form.elements["botcheck"];
      if (hp && hp.checked) return;

      var data = { name: val("name"), email: val("email"), type: val("type"), message: val("message") };

      if (!configured) {
        // Graceful fallback: compose the message in the visitor's mail app.
        var body = "Type: " + data.type + "\n\n" + data.message +
          "\n\n— " + (data.name || "(no name)") + (data.email ? " <" + data.email + ">" : "");
        window.location.href = "mailto:" + EMAIL +
          "?subject=" + encodeURIComponent("[AeroVRC] " + data.type) +
          "&body=" + encodeURIComponent(body);
        setStatus("Opening your email app…", "ok");
        return;
      }

      setBusy(true);
      setStatus("", "");
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: key,
          subject: "AeroVRC website — " + data.type,
          from_name: "AeroVRC website",
          name: data.name, email: data.email, type: data.type, message: data.message
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          setBusy(false);
          if (res && res.success) {
            form.reset();
            setStatus("Thanks! Your message has been sent.", "ok");
          } else {
            setStatus("Sorry — that didn’t go through. Please email " + EMAIL + ".", "err");
          }
        })
        .catch(function () {
          setBusy(false);
          setStatus("Network error. Please email " + EMAIL + " instead.", "err");
        });
    });
  })();
})();
