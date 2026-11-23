(function () {
  "use strict";

  var VIDEO_SRC = ["media", "omniops.mp4"].join("/");
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
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
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

  function setupVideoSlot() {
    var slot = document.querySelector("[data-video-slot]");
    if (!slot) return;

    // Probe without embedding a missing src in static HTML (keeps CI green).
    fetch(VIDEO_SRC, { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        if (res.ok) upgradeVideo(slot);
      })
      .catch(function () {
        /* keep placeholder */
      });
  }

  ready(function () {
    setupMenu();
    setupReveal();
    setupVideoSlot();
  });
})();
