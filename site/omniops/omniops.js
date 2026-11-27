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
    return video;
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

  function getVideoEl(slot) {
    return slot ? slot.querySelector("video") : null;
  }

  function setupVideoSlot() {
    var slot = document.querySelector("[data-video-slot]");
    if (!slot) return Promise.resolve(null);

    if (slot.querySelector("video")) {
      slot.classList.add("is-ready");
      return Promise.resolve(slot.querySelector("video"));
    }

    return probeVideo().then(function () {
      return upgradeVideo(slot);
    });
  }

  function setupVideoModal() {
    var dialog = document.querySelector("[data-video-dialog]");
    var home = document.querySelector("[data-video-home]");
    var slot = document.querySelector("[data-video-slot]");
    var mount = document.querySelector("[data-video-mount]");
    var openers = document.querySelectorAll("[data-video-open]");
    var closer = document.querySelector("[data-video-close]");

    if (!dialog || !home || !slot || !mount || !openers.length) return;

    var supportsDialog =
      typeof dialog.showModal === "function" &&
      typeof HTMLDialogElement !== "undefined";

    if (!supportsDialog) {
      document.documentElement.classList.add("oo-no-dialog");
      return;
    }

    document.documentElement.classList.add("oo-has-dialog");

    var lastOpener = null;

    function ensureVideo() {
      var video = getVideoEl(slot) || getVideoEl(mount);
      if (video) return video;
      return upgradeVideo(slot);
    }

    function moveVideoTo(target) {
      var video = ensureVideo();
      if (!video) return null;
      if (video.parentElement !== target) {
        target.appendChild(video);
      }
      return video;
    }

    function openModal(opener) {
      lastOpener = opener || null;
      var video = moveVideoTo(mount);
      if (!dialog.open) {
        dialog.showModal();
      }
      if (video) {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {});
        }
      }
    }

    function closeModal() {
      var video = getVideoEl(mount) || getVideoEl(slot);
      if (video) {
        video.pause();
        try {
          video.currentTime = video.currentTime;
        } catch (e) {}
      }
      moveVideoTo(slot);
      if (dialog.open) {
        dialog.close();
      }
      if (lastOpener && typeof lastOpener.focus === "function") {
        lastOpener.focus();
      }
    }

    openers.forEach(function (opener) {
      opener.addEventListener("click", function (event) {
        event.preventDefault();
        openModal(opener);
      });
    });

    if (closer) {
      closer.addEventListener("click", function () {
        closeModal();
      });
    }

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        closeModal();
      }
    });

    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeModal();
    });

    dialog.addEventListener("close", function () {
      var video = getVideoEl(mount);
      if (video) {
        video.pause();
        moveVideoTo(slot);
      }
    });
  }

  function setupHashScroll() {
    if (window.location.hash !== "#video") return;
    var target = document.getElementById("video");
    if (!target) return;
    window.setTimeout(function () {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function setupMockTabs() {
    document.querySelectorAll("[data-mock-tabs]").forEach(function (root) {
      var tabs = root.querySelectorAll("[data-mock-tab]");
      var panels = root.querySelectorAll("[data-mock-panel]");
      if (!tabs.length || !panels.length) return;

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var key = tab.getAttribute("data-mock-tab");
          tabs.forEach(function (t) {
            var on = t === tab;
            t.classList.toggle("is-active", on);
            t.setAttribute("aria-selected", on ? "true" : "false");
          });
          panels.forEach(function (panel) {
            var on = panel.getAttribute("data-mock-panel") === key;
            panel.classList.toggle("is-active", on);
          });
        });
      });
    });
  }

  ready(function () {
    setupMenu();
    setupReveal();
    setupVideoSlot().then(function () {
      setupVideoModal();
    });
    setupMockTabs();
    setupHashScroll();
  });
})();
