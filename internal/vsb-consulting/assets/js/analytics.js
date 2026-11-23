(function () {
  "use strict";

  var cfg = window.VSB_ANALYTICS || {};
  var ga4 = String(cfg.ga4 || "").trim();
  var clarity = String(cfg.clarity || "").trim();

  if (ga4 && typeof window.gtag !== "function") {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4, { anonymize_ip: true, send_page_view: true });

    var gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(ga4);
    document.head.appendChild(gtagScript);
  }

  if (clarity) {
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", clarity);
  }

  window.vsbTrackEvent = function (name, params) {
    if (typeof window.gtag !== "function" || !ga4) return;
    window.gtag("event", name, params || {});
  };
})();
