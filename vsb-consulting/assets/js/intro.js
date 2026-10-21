/**
 * VSB Consulting — homepage intro animation
 * Soft dust dissolve from logo lockup (Canvas). Once per session.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "vsb_intro_played";
  var LOGO_SRC = "assets/img/vsb-logo-mark.png";
  var NAVY = { r: 15, g: 35, b: 65 };
  var GOLD = { r: 184, g: 146, b: 46 };

  var body = document.body;
  if (!body || !body.classList.contains("page-home")) return;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var forceReplay = false;
  try {
    forceReplay = /(?:\?|&)intro=1(?:&|$)/.test(location.search);
    if (forceReplay) sessionStorage.removeItem(STORAGE_KEY);
  } catch (e0) {}

  var alreadyPlayed = false;
  try {
    alreadyPlayed = !forceReplay && sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    alreadyPlayed = false;
  }

  function finishIntro() {
    body.classList.remove("intro-pending", "intro-playing", "intro-header-in");
    body.classList.add("intro-done");
    var overlay = document.getElementById("site-intro");
    if (overlay) {
      overlay.setAttribute("aria-hidden", "true");
      overlay.classList.add("is-done");
      window.setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 800);
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (e2) {}
    window.dispatchEvent(new CustomEvent("vsb:intro-done"));
  }

  function skipToDone() {
    body.classList.remove("intro-pending", "intro-playing", "intro-header-in");
    body.classList.add("intro-done");
    var overlay = document.getElementById("site-intro");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    window.dispatchEvent(new CustomEvent("vsb:intro-done"));
  }

  if (alreadyPlayed) {
    body.classList.remove("intro-pending", "intro-playing");
    body.classList.add("intro-done", "intro-instant");
    return;
  }
  if (reduced) {
    requestAnimationFrame(function () {
      body.classList.add("intro-playing", "intro-reduced");
      window.setTimeout(finishIntro, 900);
    });
    return;
  }

  function particleCount() {
    var w = window.innerWidth;
    if (w < 480) return 520;
    if (w < 900) return 900;
    return 1400;
  }

  function mixColor() {
    // Navy-dominant, restrained gold (~18%)
    return Math.random() < 0.82 ? NAVY : GOLD;
  }

  function run() {
    var overlay = document.getElementById("site-intro");
    var canvas = document.getElementById("site-intro-canvas");
    var lockup = document.getElementById("site-intro-lockup");
    if (!overlay || !canvas || !lockup) {
      skipToDone();
      return;
    }

    body.classList.add("intro-playing");
    overlay.setAttribute("aria-hidden", "false");

    var ctx = canvas.getContext("2d", { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var particles = [];
    var raf = 0;
    var phase = "hold";
    var phaseStart = 0;
    var dissolveStart = 0;
    var running = true;
    var headerShown = false;

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Horizontal lockup: logo | wordmark — sample alpha for dust origins */
    function sampleLockup(img) {
      var vw = window.innerWidth;
      var logoH = Math.min(Math.round(vw * 0.17), 200);
      if (vw < 640) logoH = Math.min(Math.round(vw * 0.2), 128);
      var scale = logoH / img.naturalHeight;
      var lw = Math.max(1, Math.floor(img.naturalWidth * scale));
      var lh = Math.max(1, Math.floor(img.naturalHeight * scale));
      var fontSize = Math.max(20, Math.min(40, Math.round(logoH * 0.3)));
      var gap = Math.round(logoH * 0.24);
      var textW = Math.round(fontSize * 11.4);
      var totalW = lw + gap + textW;
      var off = document.createElement("canvas");
      off.width = Math.max(1, totalW);
      off.height = Math.max(1, Math.max(lh, fontSize + 8));
      var ox = Math.floor((vw - off.width) / 2);
      var oy = Math.floor((window.innerHeight - off.height) / 2);
      var octx = off.getContext("2d");
      octx.drawImage(img, 0, Math.floor((off.height - lh) / 2), lw, lh);
      octx.fillStyle = "#0f2341";
      octx.font = "600 " + fontSize + "px 'Noto Sans JP', 'Hiragino Sans', sans-serif";
      octx.textAlign = "left";
      octx.textBaseline = "middle";
      octx.fillText("VSB CONSULTING", lw + gap, off.height / 2);

      var data = octx.getImageData(0, 0, off.width, off.height).data;
      var pts = [];
      var edge = [];
      var step = 2;
      for (var y = 0; y < off.height; y += step) {
        for (var x = 0; x < off.width; x += step) {
          var i = (y * off.width + x) * 4;
          var a = data[i + 3];
          if (a < 48) continue;
          var pt = { x: ox + x, y: oy + y, a: a / 255 };
          // Prefer silhouette / mid-alpha for "contour dust"
          if (a < 200) edge.push(pt);
          else pts.push(pt);
        }
      }
      // Bias sampling toward edges (粉になる輪郭感)
      var pool = edge.concat(edge).concat(pts);
      return { pts: pool.length ? pool : pts, ox: ox, oy: oy };
    }

    function spawn(pts) {
      var n = particleCount();
      particles = [];
      if (!pts.length) return;
      var cx = window.innerWidth / 2;
      for (var i = 0; i < n; i++) {
        var src = pts[Math.floor(Math.random() * pts.length)];
        var c = mixColor();
        // Flow outward from center: left or right based on position + soft bias
        var fromLeft = src.x < cx;
        var side = fromLeft ? -1 : 1;
        if (Math.random() < 0.12) side *= -1; // slight cross-flow
        var speed = 0.12 + Math.random() * 0.38; // slow air drift
        var delay = Math.random() * 480; // staggered start = soft peel
        particles.push({
          x0: src.x + (Math.random() - 0.5) * 1.2,
          y0: src.y + (Math.random() - 0.5) * 1.2,
          x: src.x,
          y: src.y,
          side: side,
          speed: speed,
          life: 0,
          delay: delay,
          max: 1400 + Math.random() * 900,
          size: 0.55 + Math.random() * 1.35,
          r: c.r,
          g: c.g,
          b: c.b,
          wobble: 0.4 + Math.random() * 1.4,
          wobbleSp: 0.0011 + Math.random() * 0.0022,
          phase: Math.random() * Math.PI * 2,
          rise: (Math.random() - 0.45) * 0.18,
          alpha0: 0.55 + src.a * 0.35,
        });
      }
    }

    function paintParticles(now) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      var t0 = dissolveStart || now;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var local = now - t0 - p.delay;
        if (local < 0) {
          // still part of solid form — faint seed
          ctx.beginPath();
          ctx.fillStyle =
            "rgba(" + p.r + "," + p.g + "," + p.b + "," + p.alpha0 * 0.15 + ")";
          ctx.arc(p.x0, p.y0, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        var t = Math.min(1, local / p.max);
        // ease-out cubic: start slow, drift, settle into air
        var ease = 1 - Math.pow(1 - t, 3);
        var drift = ease * (90 + p.speed * 220) * p.side;
        var wobbleY =
          Math.sin(local * p.wobbleSp + p.phase) * p.wobble * (0.4 + ease * 2.2);
        p.x = p.x0 + drift + Math.sin(local * 0.0007 + p.phase) * 3 * ease;
        p.y = p.y0 + wobbleY + p.rise * local * 0.02;
        // dissolve: hold opacity briefly then melt away
        var fade = t < 0.15 ? t / 0.15 : 1 - Math.pow((t - 0.15) / 0.85, 1.35);
        var alpha = Math.max(0, fade) * p.alpha0 * (1 - ease * 0.35);
        if (alpha <= 0.02) continue;
        var sz = p.size * (1 - ease * 0.45);
        ctx.beginPath();
        ctx.fillStyle =
          "rgba(" + p.r + "," + p.g + "," + p.b + "," + alpha + ")";
        ctx.arc(p.x, p.y, Math.max(0.35, sz), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame(now) {
      if (!running) return;
      if (phase === "dissolve" || phase === "fade") {
        paintParticles(now);
        var elapsed = now - dissolveStart;

        // Lockup fades as dust peels (longer, softer)
        var logoFade = Math.max(0, 1 - elapsed / 1100);
        lockup.style.opacity = String(logoFade);
        lockup.style.filter =
          "blur(" + Math.min(4, elapsed / 400) + "px)";

        // Header emerges as dust spreads (overlay bg clears so header is visible)
        if (!headerShown && elapsed > 580) {
          headerShown = true;
          overlay.classList.add("is-header-in");
          body.classList.add("intro-header-in");
        }

        if (phase === "dissolve" && elapsed > 2300) {
          phase = "fade";
          phaseStart = now;
          overlay.classList.add("is-fading");
        } else if (phase === "fade" && now - phaseStart > 750) {
          running = false;
          cancelAnimationFrame(raf);
          finishIntro();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      resize();
      var sampled = sampleLockup(img);
      spawn(sampled.pts);

      phaseStart = performance.now();
      phase = "hold";
      lockup.classList.add("is-visible");

      window.setTimeout(function () {
        phase = "dissolve";
        dissolveStart = performance.now();
        phaseStart = dissolveStart;
        lockup.classList.add("is-dissolving");
        raf = requestAnimationFrame(frame);
      }, 1250);
    };
    img.onerror = function () {
      skipToDone();
    };
    img.src = LOGO_SRC;

    window.addEventListener(
      "resize",
      function () {
        if (!running) return;
        resize();
      },
      { passive: true }
    );

    function skip() {
      if (body.classList.contains("intro-done")) return;
      running = false;
      cancelAnimationFrame(raf);
      finishIntro();
    }
    overlay.addEventListener("click", skip);
    window.addEventListener(
      "keydown",
      function (ev) {
        if (ev.key === "Escape") skip();
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
