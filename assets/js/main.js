(function () {
  var toggle = document.querySelector("[data-menu-toggle]");
  var mobileNav = document.querySelector("[data-mobile-nav]");
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var form = document.querySelector("[data-contact-form]");
  if (!form) return;

  var status = form.querySelector("[data-form-status]");
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
        form.reset();
        if (status) {
          status.textContent =
            "送信を受け付けました。担当よりメールでご連絡します。";
          status.className = "form__status is-success";
        }
      })
      .catch(function (error) {
        if (status) {
          var message =
            "送信に失敗しました。公開先のURL（https）からお試しください。";
          if (error && error.message) {
            if (error.message.indexOf("HTML files") !== -1) {
              message =
                "このページはWebサーバー経由で開いてください。ファイルを直接開いた状態では送信できません。";
            } else {
              message = error.message;
            }
          }
          status.textContent = message;
          status.className = "form__status is-error";
        }
      });
  });
})();
