/**
 * VSB Consulting — homepage intro animation
 * Canvas particles sampled from logo lockup. Once per session (sessionStorage).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "vsb_intro_played";
  var LOGO_SRC = "assets/img/vsb-logo-mark.png";
  var NAVY = { r: 15, g: 35, b: 65 };
  var GOLD = { r: 184, g: 146, b: 46 };
  var BLUE = { r: 90, g: 130, b: 180 };

  var body = document.body;
  if (!body || !body.classList.contains("page-home")) return;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var alreadyPlayed = false;
  try {
    alreadyPlayed = sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    alreadyPlayed = false;
  }

  function finishIntro() {
    body.classList.remove("intro-pending", "intro-playing");
    body.classList.add("intro-done");
    var overlay = document.getElementById("site-intro");
    if (overlay) {
      overlay.setAttribute("aria-hidden", "true");
      overlay.classList.add("is-done");
      window.setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 700);
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (e2) {}
    window.dispatchEvent(new CustomEvent("vsb:intro-done"));
  }

  function skipToDone() {
    body.classList.remove("intro-pending", "intro-playing");
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
    if (w < 480) return 420;
    if (w < 900) return 700;
    return 1100;
  }

  function mixColor() {
    var t = Math.random();
    if (t < 0.72) return NAVY;
    if (t < 0.88) return GOLD;
    return BLUE;
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
    var phase = "hold"; // hold → dissolve → fade
    var phaseStart = 0;
    var logoAlpha = 1;
    var running = true;

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sampleLogo(img) {
      var maxW = Math.min(220, window.innerWidth * 0.42);
      var scale = maxW / img.naturalWidth;
      var lw = Math.floor(img.naturalWidth * scale);
      var lh = Math.floor(img.naturalHeight * scale);
      var textH = 36;
      var gap = 14;
      var totalH = lh + gap + textH;
      var ox = Math.floor((window.innerWidth - lw) / 2);
      var oy = Math.floor((window.innerHeight - totalH) / 2);

      var off = document.createElement("canvas");
      off.width = Math.max(1, lw);
      off.height = Math.max(1, lh + gap + textH);
      var octx = off.getContext("2d");
      octx.drawImage(img, 0, 0, lw, lh);
      octx.fillStyle = "#0f2341";
      octx.font = "600 15px 'Noto Sans JP', sans-serif";
      octx.textAlign = "center";
      octx.textBaseline = "top";
      octx.letterSpacing = "0.12em";
      octx.fillText("VSB CONSULTING", lw / 2, lh + gap);

      var data = octx.getImageData(0, 0, off.width, off.height).data;
      var pts = [];
      var step = off.width > 180 ? 3 : 2;
      for (var y = 0; y < off.height; y += step) {
        for (var x = 0; x < off.width; x += step) {
          var i = (y * off.width + x) * 4;
          if (data[i + 3] > 40) {
            pts.push({ x: ox + x, y: oy + y });
          }
        }
      }
      return { pts: pts, ox: ox, oy: oy, lw: lw, lh: lh, totalH: totalH };
    }

    function spawn(pts) {
      var n = particleCount();
      particles = [];
      if (!pts.length) return;
      for (var i = 0; i < n; i++) {
        var p = pts[Math.floor(Math.random() * pts.length)];
        var c = mixColor();
        var side = Math.random() < 0.5 ? -1 : 1;
        var dist = 80 + Math.random() * (window.innerWidth * 0.38);
        particles.push({
          x: p.x + (Math.random() - 0.5) * 2,
          y: p.y + (Math.random() - 0.5) * 2,
          vx: side * (0.35 + Math.random() * 1.1) * (dist / 160),
          vy: (Math.random() - 0.5) * 0.55,
          life: 0,
          max: 900 + Math.random() * 700,
          size: 0.8 + Math.random() * 1.8,
          r: c.r,
          g: c.g,
          b: c.b,
          drift: (Math.random() - 0.5) * 0.02,
        });
      }
    }

    function paintParticles(now) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.life = now - phaseStart;
        var t = Math.min(1, p.life / p.max);
        var ease = 1 - Math.pow(1 - t, 2.2);
        p.x += p.vx;
        p.y += p.vy + p.drift;
        p.vx *= 0.992;
        var alpha = (1 - ease) * 0.85;
        if (alpha <= 0.02) continue;
        ctx.beginPath();
        ctx.fillStyle =
          "rgba(" + p.r + "," + p.g + "," + p.b + "," + alpha + ")";
        ctx.arc(p.x, p.y, p.size * (1 - ease * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame(now) {
      if (!running) return;
      if (phase === "dissolve" || phase === "fade") {
        paintParticles(now);
        if (phase === "dissolve") {
          logoAlpha = Math.max(0, 1 - (now - phaseStart) / 700);
          lockup.style.opacity = String(logoAlpha);
          if (now - phaseStart > 420 && !overlay.classList.contains("is-header-in")) {
            overlay.classList.add("is-header-in");
            body.classList.add("intro-header-in");
          }
          if (now - phaseStart > 1500) {
            phase = "fade";
            phaseStart = now;
            overlay.classList.add("is-fading");
          }
        } else if (phase === "fade") {
          if (now - phaseStart > 550) {
            running = false;
            cancelAnimationFrame(raf);
            finishIntro();
            return;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      resize();
      var sampled = sampleLogo(img);
      spawn(sampled.pts);

      // Hold logo visible, then dissolve
      phaseStart = performance.now();
      phase = "hold";
      lockup.classList.add("is-visible");

      window.setTimeout(function () {
        phase = "dissolve";
        phaseStart = performance.now();
        lockup.classList.add("is-dissolving");
        raf = requestAnimationFrame(frame);
      }, 1100);
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

    // Escape hatch: click / Escape to skip
    function skip() {
      if (!running && body.classList.contains("intro-done")) return;
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
