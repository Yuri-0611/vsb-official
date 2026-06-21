(function (global) {
  "use strict";

  /** 日本国内（0始まり・ハイフン可）。+1 等の海外形式は不可 */
  var JP_PHONE_PATTERN = /^0[\d\-]{9,12}$/;

  /** ラテン小文字だけのランダム文字列（Bot典型） */
  var SPAM_TEXT_PATTERN = /^[a-z]{6,}$/;

  var DISPOSABLE_EMAIL_DOMAINS = [
    "immenseignite.info",
    "mailinator.com",
    "guerrillamail.com",
    "tempmail.com",
  ];

  function trim(value) {
    return (value || "").trim();
  }

  function isHoneypotFilled(form) {
    var honey = form.querySelector('[name="_honey"]');
    return !!(honey && trim(honey.value));
  }

  function validatePhone(value) {
    var phone = trim(value);
    if (!phone) return { ok: true };
    if (/^\+|^00/.test(phone)) {
      return {
        ok: false,
        message:
          "電話番号は日本国内の形式（0から始まる）で入力してください。+1 など海外形式は使用できません。",
      };
    }
    if (!JP_PHONE_PATTERN.test(phone)) {
      return {
        ok: false,
        message:
          "電話番号の形式が正しくありません。例：03-1234-5678、090-1234-5678",
      };
    }
    return { ok: true };
  }

  function validatePersonOrCompany(value, label) {
    var text = trim(value);
    if (text.length < 2) {
      return { ok: false, message: label + "を2文字以上で入力してください。" };
    }
    if (SPAM_TEXT_PATTERN.test(text)) {
      return { ok: false, message: label + "の入力内容をご確認ください。" };
    }
    return { ok: true };
  }

  function validateEmail(value) {
    var email = trim(value).toLowerCase();
    if (!email) {
      return { ok: false, message: "メールアドレスを入力してください。" };
    }
    var domain = email.split("@")[1];
    if (domain && DISPOSABLE_EMAIL_DOMAINS.indexOf(domain) !== -1) {
      return {
        ok: false,
        message: "このメールアドレスはご利用いただけません。別のアドレスをお試しください。",
      };
    }
    return { ok: true };
  }

  function validateContactForm(form) {
    if (isHoneypotFilled(form)) {
      return { ok: false, message: "", silent: true };
    }

    var company = validatePersonOrCompany(
      form.querySelector('[name="company"]') &&
        form.querySelector('[name="company"]').value,
      "会社名"
    );
    if (!company.ok) return company;

    var name = validatePersonOrCompany(
      form.querySelector('[name="name"]') && form.querySelector('[name="name"]').value,
      "お名前"
    );
    if (!name.ok) return name;

    var email = validateEmail(
      form.querySelector('[name="email"]') && form.querySelector('[name="email"]').value
    );
    if (!email.ok) return email;

    var phone = validatePhone(
      form.querySelector('[name="phone"]') && form.querySelector('[name="phone"]').value
    );
    if (!phone.ok) return phone;

    var inquiry = form.querySelector('[name="inquiry_type"]');
    var message = form.querySelector('[name="message"]');
    if (
      inquiry &&
      message &&
      inquiry.value.indexOf("その他") !== -1 &&
      trim(message.value).length < 10
    ) {
      return {
        ok: false,
        message: "「その他のお問い合わせ」は内容を10文字以上ご記入ください。",
      };
    }

    return { ok: true };
  }

  global.vsbFormAntispam = {
    validateContactForm: validateContactForm,
    validatePhone: validatePhone,
    isHoneypotFilled: isHoneypotFilled,
    JP_PHONE_PATTERN: JP_PHONE_PATTERN,
  };
})(window);
