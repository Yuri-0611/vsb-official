(function () {
  "use strict";

  /* Mobile navigation */
  var toggle = document.querySelector("[data-menu-toggle]");
  var mobileNav = document.querySelector("[data-mobile-nav]");
  var header = document.querySelector(".site-header");

  function closeMobileNav() {
    if (!mobileNav || !toggle) return;
    mobileNav.classList.remove("is-open");
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("is-open");
      toggle.classList.toggle("is-active", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMobileNav);
    });
  }

  /* Header scroll shadow */
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Scroll reveal */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Contact form */
  var form = document.querySelector("[data-contact-form]");
  if (!form) return;

  var status = form.querySelector("[data-form-status]");
  var inquirySelect = form.querySelector('[name="inquiry_type"]');
  var messageField = form.querySelector('[name="message"]');

  if (inquirySelect && messageField) {
    inquirySelect.addEventListener("change", function () {
      var isMaterial = inquirySelect.value.indexOf("資料") !== -1;
      messageField.required = !isMaterial;
      if (isMaterial && !messageField.value) {
        messageField.placeholder =
          "任意：ご関心のあるテーマや社内の状況があればご記入ください";
      }
    });
    inquirySelect.dispatchEvent(new Event("change"));
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (status) {
      status.textContent = "送信中です…";
      status.className = "form__status";
    }

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return { success: response.ok ? "true" : "false" };
        });
      })
      .then(function (data) {
        if (data && data.success === "false") {
          throw new Error(data.message || "send failed");
        }
        var next = form.querySelector('[name="_next"]');
        if (next && next.value) {
          var type = "inquiry";
          if (inquirySelect) {
            if (inquirySelect.value.indexOf("資料") !== -1) type = "materials";
            else if (inquirySelect.value.indexOf("その他") !== -1) type = "other";
          }
          if (typeof window.vsbTrackEvent === "function") {
            window.vsbTrackEvent("generate_lead", {
              form_type: type,
              page_path: location.pathname,
            });
          }
          var sep = next.value.indexOf("?") > -1 ? "&" : "?";
          window.location.href = next.value + sep + "type=" + type;
          return;
        }
        form.reset();
        if (inquirySelect) inquirySelect.dispatchEvent(new Event("change"));
        if (status) {
          status.textContent =
            "送信を受け付けました。担当よりメールでご連絡します。";
          status.className = "form__status is-success";
        }
      })
      .catch(function (error) {
        if (status) {
          var message =
            "送信に失敗しました。インターネットに接続した状態で、当サイトのお問い合わせページから再度お試しください。";
          if (error && error.message && error.message.indexOf("HTML files") !== -1) {
            message =
              "送信できませんでした。パソコンまたはスマートフォンのブラウザから、当サイトのお問い合わせページを開いているかご確認ください。";
          }
          status.textContent = message;
          status.className = "form__status is-error";
        }
      });
  });
})();
