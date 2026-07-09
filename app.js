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

  fetch("https://api.github.com/repos/" + REPO + "/releases?per_page=30", {
    headers: { Accept: "application/vnd.github+json" }
  })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (releases) {
      if (!Array.isArray(releases) || releases.length === 0) {
        setVersion("No releases published yet");
        renderChangelog([], "empty");
        return;
      }
      // GitHub returns releases ordered by created_at (tag creation), which is
      // not the same as publish order. Sort by published_at (newest first) so the
      // most recently published build is always on top, then keep the latest 5.
      releases = releases
        .filter(function (rel) { return rel && !rel.draft; })
        .sort(function (a, b) { return releaseTime(b) - releaseTime(a); })
        .slice(0, 5);
      if (releases.length === 0) {
        setVersion("No releases published yet");
        renderChangelog([], "empty");
        return;
      }
      var latest = releases[0];
      setVersion(latest.tag_name + " · " + formatDate(latest.published_at));
      renderChangelog(releases, "ok");
    })
    .catch(function () {
      setVersion("Latest release on GitHub");
      renderChangelog(null, "error");
    });

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
})();
