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
    var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [];
    var COLORS = ["96,168,255", "130,198,255", "160,180,255"]; // azure spark palette

    // mouse parallax + constellation state
    var tmx = 0, tmy = 0, smx = 0, smy = 0;      // parallax target / smoothed
    var px = -1e4, py = -1e4;                    // pointer position (offscreen = none)
    var comets = [], nextComet = 0;

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
      var depth = 0.35 + Math.random() * 0.65; // 3 loose depth layers: near moves more
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -6,
        vx: (Math.random() - 0.5) * 0.3 * depth,
        vy: (0.12 + Math.random() * 0.55) * depth, // drift downward, like the default "azure" style
        s: 1 + Math.round(Math.random() * 2),
        a: 0.09 + Math.random() * 0.34,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        d: depth,
        tp: Math.random() * 6.283,        // twinkle phase
        ts: 0.6 + Math.random() * 1.6     // twinkle speed
      };
    }
    function spawnComet(now) {
      comets.push({
        x: W * (0.1 + Math.random() * 0.8),
        y: -30,
        vx: (3.5 + Math.random() * 3) * (Math.random() < 0.5 ? 1 : -1),
        vy: 2.2 + Math.random() * 1.6
      });
      nextComet = now + 8000 + Math.random() * 7000;
    }
    function drawComets() {
      for (var i = comets.length - 1; i >= 0; i--) {
        var c = comets[i];
        c.x += c.vx;
        c.y += c.vy;
        if (c.y > H + 60 || c.x < -80 || c.x > W + 80) { comets.splice(i, 1); continue; }
        var tx = c.x - c.vx * 16, ty = c.y - c.vy * 16;
        var grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
        grad.addColorStop(0, "rgba(200,228,255,.85)");
        grad.addColorStop(1, "rgba(96,168,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = "rgba(220,238,255,.9)";
        ctx.beginPath(); ctx.arc(c.x, c.y, 1.7, 0, 6.283); ctx.fill();
        ctx.fillStyle = "rgba(130,198,255,.22)";
        ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, 6.283); ctx.fill();
      }
    }
    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      smx += (tmx - smx) * 0.04;
      smy += (tmy - smy) * 0.04;
      var near = []; // particles close to the cursor, for constellation lines
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > H + 6 || p.x < -6 || p.x > W + 6) {
          parts[i] = makeParticle(false);
          continue;
        }
        // parallax: draw position shifts with the mouse, scaled by depth
        var dx = p.x + smx * 30 * p.d;
        var dy = p.y + smy * 16 * p.d;
        // twinkle: each spark breathes on its own phase and speed
        var glow = p.a * (0.55 + 0.45 * Math.sin(now * 0.001 * p.ts + p.tp));
        // soft halo behind the larger dots -> gentle glow
        if (p.s >= 3) {
          ctx.fillStyle = "rgba(" + p.c + "," + (glow * 0.32).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(dx, dy, p.s * 1.8, 0, 6.283);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(" + p.c + "," + glow.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(dx, dy, p.s * 0.6, 0, 6.283);
        ctx.fill();
        if (near.length < 14) {
          var ddx = dx - px, ddy = dy - py;
          if (ddx * ddx + ddy * ddy < 130 * 130) near.push({ x: dx, y: dy });
        }
      }
      // constellation: nearby sparks link up around the cursor
      for (var a = 0; a < near.length; a++) {
        for (var b = a + 1; b < near.length; b++) {
          var lx = near[a].x - near[b].x, ly = near[a].y - near[b].y;
          var d2 = lx * lx + ly * ly;
          if (d2 < 110 * 110) {
            var alpha = 0.3 * (1 - Math.sqrt(d2) / 110);
            ctx.strokeStyle = "rgba(130,198,255," + alpha.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(near[a].x, near[a].y);
            ctx.lineTo(near[b].x, near[b].y);
            ctx.stroke();
          }
        }
      }
      // the occasional shooting star
      if (!nextComet) nextComet = now + 4000 + Math.random() * 6000;
      if (now > nextComet && comets.length < 1) spawnComet(now);
      drawComets();
      raf = requestAnimationFrame(frame);
    }
    var raf;
    if (fine && !reduce) {
      window.addEventListener("pointermove", function (e) {
        tmx = (e.clientX / W - 0.5) * 2;
        tmy = (e.clientY / H - 0.5) * 2;
        px = e.clientX;
        py = e.clientY;
      }, { passive: true });
      document.addEventListener("pointerleave", function () { px = -1e4; py = -1e4; });
    }
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
   * 1d. SCROLL PROGRESS — thin gradient bar along the top.
   * -------------------------------------------------------- */
  (function progressBar() {
    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    var footer = document.querySelector(".footer");
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 60 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.transform = "scaleX(" + p + ")";
      bar.classList.toggle("visible", max > 200 && window.scrollY > 40);
      // the footer world-portal brightens as you approach the bottom
      if (footer) footer.style.setProperty("--portal", (0.3 + 0.7 * p * p).toFixed(3));
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  })();

  /* -------------------------------------------------------- *
   * 1e. CARD SPOTLIGHT — a soft glow that follows the cursor
   *     across the frosted cards (see --mx/--my in style.css).
   * -------------------------------------------------------- */
  (function spotlight() {
    if (!(window.matchMedia && window.matchMedia("(pointer: fine)").matches)) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll(".explore-card, .feature").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty("--mx", x + "px");
        card.style.setProperty("--my", y + "px");
        if (!reduce) {
          // subtle 3D lean toward the cursor (keeps the CSS hover lift)
          var pxr = x / r.width - 0.5, pyr = y / r.height - 0.5;
          card.style.transform = "perspective(760px) rotateX(" + (-pyr * 4).toFixed(2) +
            "deg) rotateY(" + (pxr * 5).toFixed(2) + "deg) translateY(-5px)";
        }
      });
      card.addEventListener("pointerleave", function () { card.style.transform = ""; });
      // icon burst: a handful of dots fly out of the icon and reform
      var ficon = card.querySelector(".ficon");
      if (!ficon || reduce) return;
      card.addEventListener("pointerenter", function () {
        if (ficon.querySelector(".burst")) return;
        var burst = document.createElement("span");
        burst.className = "burst";
        for (var i = 0; i < 6; i++) {
          var dot = document.createElement("i");
          var ang = (i / 6) * Math.PI * 2 + Math.random() * 0.8;
          var dist = 20 + Math.random() * 16;
          dot.style.setProperty("--bx", (Math.cos(ang) * dist).toFixed(1) + "px");
          dot.style.setProperty("--by", (Math.sin(ang) * dist).toFixed(1) + "px");
          dot.style.animationDelay = (Math.random() * 90) + "ms";
          burst.appendChild(dot);
        }
        ficon.appendChild(burst);
        setTimeout(function () { if (burst.parentNode) burst.parentNode.removeChild(burst); }, 900);
      });
    });
  })();

  /* -------------------------------------------------------- *
   * 1f. ANIMATED ICONS — normalise every icon stroke to
   *     pathLength=1 so CSS can redraw them on hover.
   * -------------------------------------------------------- */
  (function iconStrokes() {
    document.querySelectorAll(".ficon svg").forEach(function (svg) {
      svg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon").forEach(function (el) {
        el.setAttribute("pathLength", "1");
      });
    });
  })();

  /* -------------------------------------------------------- *
   * 1g. MAGNETIC CTAs — the hero buttons lean toward the
   *     cursor a few pixels, then settle back.
   * -------------------------------------------------------- */
  (function magnetic() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;
    document.querySelectorAll(".hero-cta .btn").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - 0.5;
        var dy = (e.clientY - r.top) / r.height - 0.5;
        btn.style.transform = "translate(" + (dx * 7).toFixed(1) + "px," + (dy * 5 - 2).toFixed(1) + "px)";
      });
      btn.addEventListener("pointerleave", function () { btn.style.transform = ""; });
    });
  })();

  /* -------------------------------------------------------- *
   * 1h. HERO 3D TILT — the app window tilts in perspective
   *     toward the mouse, with a moving glare, while keeping
   *     a gentle float. Falls back to the CSS bob on touch.
   * -------------------------------------------------------- */
  (function heroTilt() {
    var fig = document.querySelector("[data-tilt]");
    if (!fig) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;
    var wrap = fig.closest(".hero-shot") || fig.parentElement;
    var glare = fig.querySelector(".tilt-glare");
    fig.classList.add("tilt-live");
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null, t0 = null;
    function loop(now) {
      if (t0 === null) t0 = now;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      var bob = Math.sin((now - t0) / 1200) * 5;
      fig.style.transform = "rotateX(" + cy.toFixed(2) + "deg) rotateY(" + cx.toFixed(2) +
        "deg) translateY(" + bob.toFixed(1) + "px)";
      raf = requestAnimationFrame(loop);
    }
    wrap.addEventListener("pointermove", function (e) {
      var r = wrap.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tx = px * 7;
      ty = -py * 6;
      if (glare) {
        glare.style.setProperty("--gx", ((px + 0.5) * 100).toFixed(1) + "%");
        glare.style.setProperty("--gy", ((py + 0.5) * 100).toFixed(1) + "%");
      }
    });
    wrap.addEventListener("pointerleave", function () { tx = 0; ty = 0; });
    // only spend frames on it while the hero shot is on screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { if (raf === null) raf = requestAnimationFrame(loop); }
          else if (raf !== null) { cancelAnimationFrame(raf); raf = null; t0 = null; }
        });
      }).observe(wrap);
    } else {
      raf = requestAnimationFrame(loop);
    }
  })();

  /* -------------------------------------------------------- *
   * 1h2. TYPEWRITER — cycles phrases in the hero lead.
   * -------------------------------------------------------- */
  (function typewriter() {
    var el = document.querySelector("[data-typewords]");
    if (!el) return;
    var words = (el.getAttribute("data-typewords") || "").split("|").filter(Boolean);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || words.length < 2) { el.textContent = words[0] || el.textContent; return; }
    var wi = 0, ci = words[0].length, del = false;
    el.textContent = words[0];
    function tick() {
      var w = words[wi];
      if (del) {
        ci--;
        if (ci <= 0) {
          ci = 0; del = false; wi = (wi + 1) % words.length;
          el.textContent = "";
          setTimeout(tick, 420);
          return;
        }
        el.textContent = w.slice(0, ci);
        setTimeout(tick, 24);
      } else {
        ci++;
        if (ci >= w.length) {
          ci = w.length; del = true;
          el.textContent = w;
          setTimeout(tick, 3200);
          return;
        }
        el.textContent = w.slice(0, ci);
        setTimeout(tick, 38 + Math.random() * 42);
      }
    }
    setTimeout(tick, 2800);
  })();

  /* -------------------------------------------------------- *
   * 1h3. MINI DASHBOARD — the floating session card actually
   *      ticks: uptime counts every second, players wander.
   * -------------------------------------------------------- */
  (function miniDash() {
    var up = document.querySelector("[data-md-uptime]");
    if (!up) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // leave the static values from the HTML
    var pl = document.querySelector("[data-md-players]");
    var secs = 2 * 3600 + 47 * 60 + 13;
    var players = 14;
    function fmt(s) {
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
      return h + "h " + (m < 10 ? "0" : "") + m + "m " + (x < 10 ? "0" : "") + x + "s";
    }
    setInterval(function () { secs++; up.textContent = fmt(secs); }, 1000);
    if (pl) {
      setInterval(function () {
        players = Math.max(11, Math.min(17, players + (Math.random() < 0.5 ? -1 : 1)));
        pl.textContent = players;
      }, 7000);
    }
  })();

  /* -------------------------------------------------------- *
   * 1h4. BEFORE/AFTER SLIDER — an invisible range input drives
   *      the clip position, so it works with mouse, touch and
   *      keyboard for free.
   * -------------------------------------------------------- */
  (function baSlider() {
    var frame = document.querySelector("[data-ba]");
    if (!frame) return;
    var range = frame.querySelector("[data-ba-range]");
    if (!range) return;
    function apply() { frame.style.setProperty("--pos", range.value + "%"); }
    range.addEventListener("input", apply);
    apply();
  })();

  /* -------------------------------------------------------- *
   * 1i. WIREFRAME HEADSET — a procedural 3D VR headset drawn
   *     as glowing lines behind the hero headline. It slowly
   *     turns on its own and leans toward the mouse.
   * -------------------------------------------------------- */
  (function headset() {
    var canvas = document.getElementById("headset");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---- build the model once: polylines of [x, y, z] points.
       Proportions are traced from Quest 3 reference views: soft
       squircle visor with an inset faceplate, the three vertical
       camera pills, flat fabric straps and a soft back cradle. ---- */
    function superellipse(w, h, nx, ny, steps) { // squircle / capsule outline
      var pts = [];
      for (var i = 0; i < steps; i++) {
        var t = (i / steps) * Math.PI * 2;
        var c = Math.cos(t), s = Math.sin(t);
        pts.push([w * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 2 / nx),
                  h * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 2 / ny)]);
      }
      return pts;
    }
    function bezier(p0, p1, p2, p3, steps) {
      var pts = [];
      for (var i = 0; i <= steps; i++) {
        var t = i / steps, u = 1 - t, pt = [0, 0, 0];
        for (var a = 0; a < 3; a++) {
          pt[a] = u * u * u * p0[a] + 3 * u * u * t * p1[a] + 3 * u * t * t * p2[a] + t * t * t * p3[a];
        }
        pts.push(pt);
      }
      return pts;
    }
    // Quest 3's front is fairly flat, wrapping back only at the edges
    var zFront = function (x) { return 0.5 - 0.22 * Math.pow(x / 1.25, 2); };

    var paths = [];
    // visor: outer bumper ring + inset faceplate (the double-line rim)
    paths.push({ pts: superellipse(1.25, 0.62, 3.2, 3.2, 52).map(function (p) { return [p[0], p[1], zFront(p[0])]; }), close: true, w: 1.5 });
    paths.push({ pts: superellipse(1.16, 0.54, 3.2, 3.2, 52).map(function (p) { return [p[0], p[1], zFront(p[0]) + 0.05]; }), close: true, w: 1.0 });
    // rear opening + facial-interface cushion
    paths.push({ pts: superellipse(1.1, 0.55, 3.2, 3.2, 48).map(function (p) { return [p[0], p[1], -0.42]; }), close: true, w: 1.1 });
    paths.push({ pts: superellipse(0.95, 0.46, 3.2, 3.2, 40).map(function (p) { return [p[0], p[1], -0.34]; }), close: true, w: 0.9 });
    // short side connectors at the midline — enough to read the wedge profile
    // from the side without any line ghosting across the see-through faceplate
    paths.push({ pts: [[-1.25, 0, zFront(-1.25)], [-1.1, 0, -0.42]], close: false, w: 1.0, am: 0.85 });
    paths.push({ pts: [[1.25, 0, zFront(1.25)], [1.1, 0, -0.42]], close: false, w: 1.0, am: 0.85 });
    // short crown / chin rails at the centreline
    paths.push({ pts: [[0, 0.62, zFront(0)], [0, 0.55, -0.42]], close: false, w: 1.0, am: 0.8 });
    paths.push({ pts: [[0, -0.62, zFront(0)], [0, -0.55, -0.42]], close: false, w: 1.0, am: 0.8 });
    // the three signature vertical camera pills on the faceplate
    [-0.42, 0, 0.42].forEach(function (cx) {
      var pill = superellipse(0.075, 0.23, 2, 5, 26).map(function (p) {
        var x = cx + p[0];
        return [x, p[1] - 0.02, zFront(x) + 0.045];
      });
      paths.push({ pts: pill, close: true, w: 1.2 });
    });
    // interior eyepieces — kept faint so they read as depth, not clutter
    [-0.33, 0.33].forEach(function (cx) {
      var lens = [];
      for (var i = 0; i < 26; i++) {
        var t = (i / 26) * Math.PI * 2;
        lens.push([cx + Math.cos(t) * 0.2, Math.sin(t) * 0.2, -0.3]);
      }
      paths.push({ pts: lens, close: true, w: 0.9, am: 0.55 });
    });
    // wide flat side straps, drawn as band edges sweeping back to the cradle
    // (am dims them a touch so they don't fight the visor when seen through it)
    [-1, 1].forEach(function (sgn) {
      var top = bezier([sgn * 1.22, 0.18, -0.12], [sgn * 1.46, 0.26, -0.85], [sgn * 1.08, 0.32, -1.5], [sgn * 0.34, 0.3, -1.78], 20);
      var bot = bezier([sgn * 1.22, -0.18, -0.12], [sgn * 1.46, -0.02, -0.85], [sgn * 1.1, 0.1, -1.5], [sgn * 0.34, 0.08, -1.78], 20);
      paths.push({ pts: top, close: false, w: 1.3, am: 0.75 });
      paths.push({ pts: bot, close: false, w: 1.3, am: 0.75 });
      paths.push({ pts: [top[top.length - 1], bot[bot.length - 1]], close: false, w: 1.0, am: 0.75 });
    });
    // wide top strap over the crown, converging slightly at the back
    [-1, 1].forEach(function (sgn) {
      paths.push({ pts: bezier([sgn * 0.16, 0.58, 0], [sgn * 0.16, 1.04, -0.6], [sgn * 0.15, 0.9, -1.4], [sgn * 0.1, 0.44, -1.72], 20), close: false, w: 1.2, am: 0.8 });
    });
    paths.push({ pts: [[-0.1, 0.44, -1.72], [0.1, 0.44, -1.72]], close: false, w: 1.0, am: 0.8 });
    // soft back cradle where the straps meet
    paths.push({ pts: superellipse(0.36, 0.24, 3, 3, 30).map(function (p) { return [p[0], p[1] + 0.17, -1.8]; }), close: true, w: 1.1 });
    // glow nodes at the strap junctions + the depth-sensor dot in the centre pill
    var nodes = [[-0.34, 0.19, -1.78], [0.34, 0.19, -1.78], [0, 0.44, -1.72]];
    var emblem = [0, -0.03, zFront(0) + 0.06];

    /* ---- render ---- */
    var tmx = 0, tmy = 0, smx = 0, smy = 0, raf = null;
    function render(now) {
      ctx.clearRect(0, 0, W, H);
      smx += (tmx - smx) * 0.05;
      smy += (tmy - smy) * 0.05;
      // slow auto-turn + mouse lean + scroll scrub (turns as you leave the hero)
      var yaw = now * 0.00022 + smx * 0.6 + (window.scrollY || 0) * 0.0022;
      var pitch = -0.1 + smy * 0.35;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var k = Math.min(W / 4.4, H / 2.9), f = 3.6;
      function proj(p) {
        var x = p[0], y = p[1] - 0.12, z = p[2] + 0.65; // centre the model
        var x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
        var y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        var s = f / (f - z2);
        return [W / 2 + x1 * k * s, H / 2 - y1 * k * s, z2, s];
      }
      paths.forEach(function (path) {
        var pp = path.pts.map(proj);
        // soft glow pass
        ctx.strokeStyle = "rgba(74,156,255,.08)";
        ctx.lineWidth = path.w + 3.5;
        ctx.beginPath();
        pp.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        if (path.close) ctx.closePath();
        ctx.stroke();
        // bright pass, faded by depth
        ctx.lineWidth = path.w;
        var segs = path.close ? pp.length : pp.length - 1;
        for (var i = 0; i < segs; i++) {
          var a = pp[i], b = pp[(i + 1) % pp.length];
          var depth = (a[2] + b[2]) / 2;
          var alpha = Math.max(0.14, Math.min(0.9, 0.5 + depth * 0.33)) * (path.am || 1);
          ctx.strokeStyle = "rgba(148,204,255," + alpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      });
      nodes.forEach(function (n) {
        var p = proj(n);
        var alpha = Math.max(0.2, Math.min(1, 0.55 + p[2] * 0.33));
        ctx.fillStyle = "rgba(74,156,255," + (alpha * 0.25).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p[0], p[1], 5 * p[3], 0, 6.283); ctx.fill();
        ctx.fillStyle = "rgba(190,225,255," + alpha.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.8 * p[3], 0, 6.283); ctx.fill();
      });
      var e = proj(emblem);
      var pulse = 1.7 + Math.sin(now * 0.003) * 0.4; // depth-sensor dot in the centre pill
      ctx.fillStyle = "rgba(74,156,255,.28)";
      ctx.beginPath(); ctx.arc(e[0], e[1], pulse * 2 * e[3], 0, 6.283); ctx.fill();
      ctx.fillStyle = "rgba(220,238,255,.9)";
      ctx.beginPath(); ctx.arc(e[0], e[1], pulse * e[3], 0, 6.283); ctx.fill();
    }
    function frame(now) { render(now); raf = requestAnimationFrame(frame); }

    resize();
    window.addEventListener("resize", function () { resize(); if (reduce) render(2400); });
    if (fine && !reduce) {
      window.addEventListener("pointermove", function (e) {
        tmx = (e.clientX / window.innerWidth - 0.5) * 2;
        tmy = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    if (reduce) { smx = 0.3; render(2400); return; } // one static, nicely angled frame
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { if (raf === null) raf = requestAnimationFrame(frame); }
          else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }).observe(canvas);
    } else {
      raf = requestAnimationFrame(frame);
    }
  })();

  /* -------------------------------------------------------- *
   * 1j. LIVE VRCHAT PLAYERS — the public visits endpoint needs
   *     no auth; the badge only appears if it loads.
   * -------------------------------------------------------- */
  (function vrchatVisits() {
    var els = document.querySelectorAll("[data-visits]");
    if (!els.length) return;
    // VRChat's endpoint is public but sends no CORS header, so direct browser
    // reads are usually blocked. Set window.AEROVRC_VISITS_URL to a tiny proxy
    // (e.g. a free Cloudflare Worker that forwards /api/1/visits with CORS)
    // and the badge lights up; until then it simply stays hidden.
    var urls = [window.AEROVRC_VISITS_URL,
                "https://api.vrchat.cloud/api/1/visits",
                "https://vrchat.com/api/1/visits"].filter(Boolean);
    var timer = null;
    function apply(n) {
      els.forEach(function (el) { el.textContent = n.toLocaleString(); });
      document.querySelectorAll("[data-visits-wrap]").forEach(function (el) { el.removeAttribute("hidden"); });
    }
    function attempt(i) {
      if (i >= urls.length) return;
      fetch(urls[i], { headers: { Accept: "text/plain" } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(function (t) {
          var n = Number(String(t).trim());
          if (!isFinite(n) || n <= 0) throw new Error("bad payload");
          apply(n);
          if (!timer) timer = setInterval(function () { attempt(i); }, 300000); // refresh every 5 min
        })
        .catch(function () { attempt(i + 1); });
    }
    attempt(0);
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

  /* ---- live stat band: numbers count up once they scroll into view ---- */
  var reduceStats = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Odometer: every digit is a vertical strip of numbers that rolls one full
  // loop and lands on its target with a slight overshoot, slot-machine style.
  function countUp(el, n) {
    var str = (n || 0).toLocaleString();
    if (reduceStats) { el.textContent = str; return; }
    el.classList.add("odo");
    el.textContent = "";
    var cols = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch >= "0" && ch <= "9") {
        var col = document.createElement("span");
        col.className = "odo-col";
        var strip = document.createElement("span");
        strip.className = "odo-strip";
        var target = ch.charCodeAt(0) - 48;
        var total = 10 + target;           // one full 0-9 loop, then land
        for (var d = 0; d <= total + 1; d++) { // +1 spare cell for the overshoot
          var cell = document.createElement("span");
          cell.className = "odo-cell";
          cell.textContent = String(d % 10);
          strip.appendChild(cell);
        }
        strip.style.transitionDelay = (i * 70) + "ms";
        col.appendChild(strip);
        el.appendChild(col);
        cols.push({ strip: strip, total: total });
      } else {
        var sep = document.createElement("span");
        sep.className = "odo-sep";
        sep.textContent = ch;
        el.appendChild(sep);
      }
    }
    // roll on the next frame so the transition has a start state to leave
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        cols.forEach(function (c) {
          c.strip.style.transform = "translateY(calc(-" + c.total + " * var(--odoh,1.18em)))";
        });
      });
    });
  }
  var statIO = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      statIO.unobserve(e.target);
      countUp(e.target, e.target._statValue || 0);
    });
  }, { threshold: 0.5 }) : null;
  function setStat(name, value) {
    document.querySelectorAll("[data-stat-" + name + "]").forEach(function (el) {
      if (el.hasAttribute("data-countup") && statIO) { el._statValue = value; statIO.observe(el); }
      else if (el.hasAttribute("data-countup")) { countUp(el, value); }
      else { el.textContent = value; }
    });
  }
  function hideStatband() {
    document.querySelectorAll("[data-statband]").forEach(function (el) { el.setAttribute("hidden", ""); });
  }

  if (!configured) {
    setVersion("Set your GitHub repo in index.html to enable downloads");
    hideStatband();
    renderChangelog(null, "unconfigured");
    return;
  }

  // Only hit the GitHub API on pages that actually display something from it
  // (version, changelog, download count, or the splash's "what's new" pill).
  if (!document.querySelector("[data-version]") &&
      !document.querySelector("[data-changelog]") &&
      !document.querySelector("[data-changelog-full]") &&
      !document.querySelector("[data-downloads]") &&
      !document.querySelector("[data-statband]") &&
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
        hideStatband();
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
        hideStatband();
        renderChangelog([], "empty");
        renderChangelogFull([], "empty");
        return;
      }
      var latest = releases[0];
      setVersion(latest.tag_name + " · " + formatDate(latest.published_at));
      setLatest(latest);
      setDownloads(sumDownloads(all));
      setStat("downloads", sumDownloads(all));
      setStat("releases", releases.length);
      setStat("version", latest.tag_name);
      renderChangelog(releases.slice(0, 5), "ok");
      renderChangelogFull(releases, "ok");
    })
    .catch(function () {
      setVersion("Latest release on GitHub");
      setDownloadsError();
      hideStatband();
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

  /* ---- release notes: a small, safe Markdown subset ---------------------
     GitHub release bodies are Markdown, so rendering them as plain text
     printed literal "##" and "-" markers. We support the subset the notes
     actually use - headings, bullets, blockquotes, bold, inline code and
     links - and escape everything first, so a release body can never inject
     markup. Anything outside the subset degrades to plain text. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inlineMd(s) {
    var out = esc(s), stash = [];
    function keep(html) { stash.push(html); return "\u0000" + (stash.length - 1) + "\u0000"; }
    function link(url, text) {
      // Trailing sentence punctuation is not part of the URL.
      var trail = "";
      url = url.replace(/[.,;:!?)]+$/, function (m) { trail = m; return ""; });
      if (!url) return esc(text) + trail;
      return keep('<a href="' + url + '" target="_blank" rel="noopener">' + text + "</a>") + trail;
    }
    // Markdown links first, so the bare-URL pass can't re-wrap their targets.
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) { return link(u, t); });
    out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, pre, u) { return pre + link(u, u); });
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>")
             .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return out.replace(/\u0000(\d+)\u0000/g, function (_, i) { return stash[i]; });
  }
  function renderNotes(md) {
    var lines = String(md == null ? "" : md).replace(/\r/g, "").split("\n");
    var html = "", mode = null, para = [], items = [];
    function flush() {
      if (mode === "p" && para.length) html += "<p>" + inlineMd(para.join(" ")) + "</p>";
      else if (mode === "quote" && para.length) html += "<blockquote>" + inlineMd(para.join(" ")) + "</blockquote>";
      else if (mode === "ul" && items.length) html += "<ul>" + items.join("") + "</ul>";
      para = []; items = []; mode = null;
    }
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flush(); return; }
      var h = /^(#{1,6})\s+(.+)$/.exec(line);
      if (h) {
        flush();
        // Headings are demoted two levels: the page owns h2 and the release
        // title is its own element, so notes must never outrank them.
        var lvl = Math.min(6, h[1].length + 2);
        html += "<h" + lvl + ">" + inlineMd(h[2]) + "</h" + lvl + ">";
        return;
      }
      var li = /^[-*+]\s+(.+)$/.exec(line);
      if (li) {
        if (mode !== "ul") flush();
        mode = "ul"; items.push("<li>" + inlineMd(li[1]) + "</li>");
        return;
      }
      var q = /^>\s?(.*)$/.exec(line);
      if (q) {
        if (mode !== "quote") flush();
        mode = "quote"; para.push(q[1]);
        return;
      }
      if (mode !== "p") flush();
      mode = "p"; para.push(line);
    });
    flush();
    return html;
  }
  function fillNotes(el, md) {
    var body = (md || "").trim();
    var html = body ? renderNotes(body) : "";
    if (html) el.innerHTML = html;
    else el.textContent = body || "No notes for this release.";
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
      var body = document.createElement("div");
      body.className = "cl-body";
      fillNotes(body, rel.body);
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
      var body = document.createElement("div");
      body.className = "cl-body";
      fillNotes(body, rel.body);
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
      if (!button) return;
      button.disabled = busy;
      var label = button.querySelector("[data-btn-label]");
      if (label) label.textContent = busy ? "Sending…" : "Send message";
      else button.textContent = busy ? "Sending…" : "Send message";
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
