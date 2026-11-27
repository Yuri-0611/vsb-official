(function () {
  "use strict";

  var VIDEO_SRC = "./media/omniops.mp4";
  var POSTER_SRC = "media/poster.jpg";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function setupMenu() {
    var toggle = document.querySelector("[data-menu-toggle]");
    var nav = document.querySelector("[data-mobile-nav]");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function setupReveal() {
    var nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) return;

    function revealAll() {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }

    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach(function (el) {
      io.observe(el);
    });

    // Safety net: never leave content permanently hidden.
    window.setTimeout(function () {
      nodes.forEach(function (el) {
        if (!el.classList.contains("is-visible")) {
          el.classList.add("is-visible");
        }
      });
    }, 2000);
  }

  function upgradeVideo(slot) {
    var video = document.createElement("video");
    video.setAttribute("controls", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "none");
    video.setAttribute("poster", POSTER_SRC);
    video.setAttribute("controlslist", "nodownload");
    video.className = "oo-video__player";
    video.setAttribute("aria-label", "OmniOpsの解説動画（約1分）");

    var source = document.createElement("source");
    source.src = VIDEO_SRC;
    source.type = "video/mp4";
    video.appendChild(source);

    slot.innerHTML = "";
    slot.appendChild(video);
    slot.classList.add("is-ready");
  }

  function probeVideo() {
    return fetch(VIDEO_SRC, { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        if (res.ok) return true;
        return fetch(VIDEO_SRC, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          cache: "no-store",
        }).then(function (rangeRes) {
          return rangeRes.ok || rangeRes.status === 206;
        });
      })
      .catch(function () {
        return false;
      });
  }

  function setupVideoSlot() {
    var slot = document.querySelector("[data-video-slot]");
    if (!slot) return;

    // Static HTML already ships the player when the file is present.
    if (slot.querySelector("video")) {
      slot.classList.add("is-ready");
      return;
    }

    // Prefer HEAD, then ranged GET. If the host rejects probes, still render
    // because omniops.mp4 ships with the page.
    probeVideo().then(function () {
      upgradeVideo(slot);
    });
  }

  ready(function () {
    setupMenu();
    setupReveal();
    setupVideoSlot();
  });
})();
