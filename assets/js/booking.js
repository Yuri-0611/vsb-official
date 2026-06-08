(function () {
  "use strict";

  var root = document.querySelector("[data-booking]");
  if (!root) return;

  var CONFIG = {
    slots: [
      "09:00", "10:00", "11:00", "12:00",
      "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
    ],
    workDays: [1, 2, 3, 4, 5],
    minDaysAhead: 1,
    maxDaysAhead: 45,
    blockedDates: [],
    slotLabel: "1時間",
    slotMinutes: 60,
    /** contact.html の data-booking-calendar-api に設定。空なら全枠表示 */
    calendarApiUrl: root.getAttribute("data-booking-calendar-api") || "",
  };

  var state = {
    format: "",
    date: "",
    time: "",
    viewYear: 0,
    viewMonth: 0,
    availability: {},
    calendarSync: "idle",
    calendarError: "",
    fetchToken: 0,
  };

  var today = startOfDay(new Date());

  var els = {
    format: root.querySelector("[data-booking-format]"),
    calendar: root.querySelector("[data-booking-calendar]"),
    calTitle: root.querySelector("[data-booking-cal-title]"),
    calPrev: root.querySelector("[data-booking-cal-prev]"),
    calNext: root.querySelector("[data-booking-cal-next]"),
    slots: root.querySelector("[data-booking-slots]"),
    slotsEmpty: root.querySelector("[data-booking-slots-empty]"),
    slotsLoading: root.querySelector("[data-booking-slots-loading]"),
    summary: root.querySelector("[data-booking-summary]"),
    syncStatus: root.querySelector("[data-booking-sync]"),
    form: root.querySelector("[data-booking-form]"),
    status: root.querySelector("[data-booking-status]"),
    hiddenDate: root.querySelector('[name="preferred_date"]'),
    hiddenTime: root.querySelector('[name="preferred_time"]'),
    hiddenFormat: root.querySelector('[name="consultation_format"]'),
    hiddenSummary: root.querySelector('[name="booking_summary"]'),
  };

  init();

  function init() {
    var d = addDays(today, CONFIG.minDaysAhead);
    state.viewYear = d.getFullYear();
    state.viewMonth = d.getMonth();
    bindFormat();
    bindCalendarNav();
    renderCalendar();
    renderSlots();
    bindForm();
    updateSyncStatus();
    if (CONFIG.calendarApiUrl) {
      loadMonthAvailability();
    } else {
      state.calendarSync = "offline";
      updateSyncStatus();
    }
  }

  function bindFormat() {
    if (!els.format) return;
    els.format.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-format]");
      if (!btn) return;
      state.format = btn.getAttribute("data-format");
      els.format.querySelectorAll("[data-format]").forEach(function (b) {
        b.classList.toggle("is-selected", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      updateSummary();
      validateForm();
    });
  }

  function bindCalendarNav() {
    if (els.calPrev) {
      els.calPrev.addEventListener("click", function () {
        state.viewMonth--;
        if (state.viewMonth < 0) {
          state.viewMonth = 11;
          state.viewYear--;
        }
        renderCalendar();
        loadMonthAvailability();
      });
    }
    if (els.calNext) {
      els.calNext.addEventListener("click", function () {
        state.viewMonth++;
        if (state.viewMonth > 11) {
          state.viewMonth = 0;
          state.viewYear++;
        }
        renderCalendar();
        loadMonthAvailability();
      });
    }
  }

  function loadMonthAvailability() {
    if (!CONFIG.calendarApiUrl) return;

    var range = getMonthRange(state.viewYear, state.viewMonth);
    var token = ++state.fetchToken;
    state.calendarSync = "loading";
    state.calendarError = "";
    updateSyncStatus();

    fetchCalendarJsonp(CONFIG.calendarApiUrl, range.start, range.end)
      .then(function (data) {
        if (token !== state.fetchToken) return;
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "calendar api error");
        }
        if (data.slots && data.slots.length) {
          CONFIG.slots = data.slots;
        }
        if (data.slotMinutes) {
          CONFIG.slotMinutes = data.slotMinutes;
        }
        state.availability = data.days || {};
        state.calendarSync = "ok";
        state.calendarError = "";
        if (state.date && !dayHasSlots(state.date)) {
          state.date = "";
          state.time = "";
        } else if (state.time && !isSlotAvailable(state.date, state.time)) {
          state.time = "";
        }
        renderCalendar();
        renderSlots();
        updateSummary();
        validateForm();
        updateSyncStatus();
      })
      .catch(function (err) {
        if (token !== state.fetchToken) return;
        state.calendarSync = "error";
        state.calendarError = err && err.message ? err.message : "sync failed";
        updateSyncStatus();
      });
  }

  function fetchCalendarJsonp(baseUrl, start, end) {
    return new Promise(function (resolve, reject) {
      var cb = "vsbBookingCal" + Date.now();
      var sep = baseUrl.indexOf("?") > -1 ? "&" : "?";
      var src =
        baseUrl +
        sep +
        "start=" +
        encodeURIComponent(start) +
        "&end=" +
        encodeURIComponent(end) +
        "&callback=" +
        cb;
      var script = document.createElement("script");
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error("カレンダー同期がタイムアウトしました"));
      }, 12000);

      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("カレンダーAPIに接続できません"));
      };

      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      script.src = src;
      document.head.appendChild(script);
    });
  }

  function getMonthRange(year, month) {
    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);
    var start = addDays(first, -7);
    var end = addDays(last, 7);
    if (start < addDays(today, CONFIG.minDaysAhead)) {
      start = addDays(today, CONFIG.minDaysAhead);
    }
    var maxEnd = addDays(today, CONFIG.maxDaysAhead);
    if (end > maxEnd) end = maxEnd;
    return { start: toISO(start), end: toISO(end) };
  }

  function updateSyncStatus() {
    if (!els.syncStatus) return;
    var text = "";
    var cls = "booking__sync";

    if (!CONFIG.calendarApiUrl) {
      text =
        "カレンダー未連携：全ての候補枠を表示しています（API URL設定後に自動で空き枠のみ表示）。";
      cls += " booking__sync--offline";
    } else if (state.calendarSync === "loading") {
      text = "Googleカレンダーを確認しています…";
      cls += " booking__sync--loading";
    } else if (state.calendarSync === "ok") {
      text =
        "Googleカレンダーと同期済み。業務時間は平日9:00〜19:00（土日祝除く）。カレンダーの予定と重なる枠は自動で除外します。";
      cls += " booking__sync--ok";
    } else if (state.calendarSync === "error") {
      text =
        "カレンダー同期に失敗しました。時間枠は参考表示です。お手数ですがフォーム送信後に調整します。";
      cls += " booking__sync--error";
    }

    els.syncStatus.className = cls;
    els.syncStatus.textContent = text;
  }

  function renderCalendar() {
    if (!els.calendar || !els.calTitle) return;

    els.calTitle.textContent =
      state.viewYear + "年" + (state.viewMonth + 1) + "月";

    var first = new Date(state.viewYear, state.viewMonth, 1);
    var startPad = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();

    var html = '<div class="booking__weekdays" aria-hidden="true">';
    ["月", "火", "水", "木", "金", "土", "日"].forEach(function (w) {
      html += "<span>" + w + "</span>";
    });
    html += '</div><div class="booking__days">';

    for (var i = 0; i < startPad; i++) {
      html += '<span class="booking__day booking__day--empty"></span>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateObj = new Date(state.viewYear, state.viewMonth, day);
      var iso = toISO(dateObj);
      var selectable = isSelectable(dateObj);
      var hasSlots = !CONFIG.calendarApiUrl || state.calendarSync !== "ok" || dayHasSlots(iso);
      var canPick = selectable && hasSlots;
      var selected = state.date === iso;
      var cls = "booking__day";
      if (!canPick) cls += " booking__day--disabled";
      if (selected) cls += " booking__day--selected";

      if (canPick) {
        html +=
          '<button type="button" class="' +
          cls +
          '" data-date="' +
          iso +
          '" aria-pressed="' +
          (selected ? "true" : "false") +
          '">' +
          day +
          "</button>";
      } else {
        html +=
          '<span class="' +
          cls +
          '" aria-hidden="true" title="' +
          (selectable && !hasSlots ? "空き枠なし" : "") +
          '">' +
          day +
          "</span>";
      }
    }

    html += "</div>";
    els.calendar.innerHTML = html;

    els.calendar.querySelectorAll("[data-date]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.date = btn.getAttribute("data-date");
        state.time = "";
        renderCalendar();
        renderSlots();
        updateSummary();
        validateForm();
      });
    });
  }

  function renderSlots() {
    if (!els.slots) return;

    if (!state.date) {
      els.slots.innerHTML = "";
      if (els.slotsEmpty) els.slotsEmpty.hidden = false;
      if (els.slotsLoading) els.slotsLoading.hidden = true;
      return;
    }

    if (els.slotsEmpty) els.slotsEmpty.hidden = true;

    if (CONFIG.calendarApiUrl && state.calendarSync === "loading") {
      els.slots.innerHTML = "";
      if (els.slotsLoading) els.slotsLoading.hidden = false;
      return;
    }
    if (els.slotsLoading) els.slotsLoading.hidden = true;

    var html = "";
    var anyAvailable = false;

    CONFIG.slots.forEach(function (time) {
      var available = isSlotAvailable(state.date, time);
      if (available) anyAvailable = true;
      var selected = state.time === time;
      var cls = "booking__slot";
      if (selected) cls += " is-selected";
      if (!available) cls += " booking__slot--busy";

      if (available) {
        html +=
          '<button type="button" class="' +
          cls +
          '" data-time="' +
          time +
          '" aria-pressed="' +
          (selected ? "true" : "false") +
          '">' +
          time +
          "〜" +
          addMinutes(time, CONFIG.slotMinutes) +
          "</button>";
      } else {
        html +=
          '<span class="' +
          cls +
          '" aria-disabled="true" title="予定と重なるため選択できません">' +
          time +
          "〜" +
          addMinutes(time, CONFIG.slotMinutes) +
          "<small>不可</small></span>";
      }
    });

    els.slots.innerHTML = html;

    if (!anyAvailable && els.slotsEmpty) {
      els.slotsEmpty.hidden = false;
      els.slotsEmpty.textContent =
        "この日は空き枠がありません。別の日をお選びください。";
    }

    els.slots.querySelectorAll("[data-time]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.time = btn.getAttribute("data-time");
        renderSlots();
        updateSummary();
        validateForm();
      });
    });
  }

  function dayHasSlots(iso) {
    if (!CONFIG.calendarApiUrl || state.calendarSync !== "ok") return true;
    var slots = state.availability[iso];
    return Array.isArray(slots) && slots.length > 0;
  }

  function isSlotAvailable(iso, time) {
    if (!CONFIG.calendarApiUrl || state.calendarSync !== "ok") return true;
    var slots = state.availability[iso];
    if (!Array.isArray(slots)) return true;
    return slots.indexOf(time) !== -1;
  }

  function updateSummary() {
    if (!els.summary) return;
    var parts = [];
    if (state.format) {
      parts.push(state.format === "online" ? "オンライン" : "対面（横浜・神奈川）");
    }
    if (state.date) {
      parts.push(formatDateJP(state.date));
    }
    if (state.time) {
      parts.push(
        state.time +
          "〜" +
          addMinutes(state.time, CONFIG.slotMinutes) +
          "（" +
          CONFIG.slotLabel +
          "）"
      );
    }

    if (parts.length === 0) {
      els.summary.textContent = "形式・日付・時間を選択してください。";
      els.summary.classList.remove("is-ready");
      return;
    }

    els.summary.textContent = parts.join(" ／ ");
    els.summary.classList.toggle(
      "is-ready",
      !!(state.format && state.date && state.time)
    );

    if (els.hiddenDate) els.hiddenDate.value = state.date;
    if (els.hiddenTime) {
      els.hiddenTime.value = state.time
        ? state.time + "〜" + addMinutes(state.time, CONFIG.slotMinutes)
        : "";
    }
    if (els.hiddenFormat) {
      els.hiddenFormat.value =
        state.format === "online"
          ? "オンライン"
          : state.format === "inperson"
          ? "対面"
          : "";
    }
    if (els.hiddenSummary) {
      els.hiddenSummary.value = parts.join(" / ");
    }
  }

  function validateForm() {
    if (!els.form) return;
    var submit = els.form.querySelector('[type="submit"]');
    var ready =
      !!(state.format && state.date && state.time) &&
      isSlotAvailable(state.date, state.time);
    if (submit) submit.disabled = !ready;
  }

  function bindForm() {
    if (!els.form) return;
    validateForm();

    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!(state.format && state.date && state.time)) return;
      if (!isSlotAvailable(state.date, state.time)) {
        if (els.status) {
          els.status.textContent =
            "選択した時間は直近で埋まりました。別の枠をお選びください。";
          els.status.className = "form__status is-error";
        }
        loadMonthAvailability();
        return;
      }

      if (els.status) {
        els.status.textContent = "予約を送信しています…";
        els.status.className = "form__status";
      }

      fetch(els.form.action, {
        method: "POST",
        body: new FormData(els.form),
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
          var next = els.form.querySelector('[name="_next"]');
          if (next && next.value) {
            window.location.href =
              next.value +
              (next.value.indexOf("?") > -1 ? "&" : "?") +
              "type=booking";
            return;
          }
          if (els.status) {
            els.status.textContent =
              "ご希望を受け付けました。担当より確定日時をメールでご連絡します。";
            els.status.className = "form__status is-success";
          }
        })
        .catch(function () {
          if (els.status) {
            els.status.textContent =
              "送信に失敗しました。接続を確認のうえ、再度お試しください。";
            els.status.className = "form__status is-error";
          }
        });
    });
  }

  function isSelectable(dateObj) {
    var d = startOfDay(dateObj);
    if (d < addDays(today, CONFIG.minDaysAhead)) return false;
    if (d > addDays(today, CONFIG.maxDaysAhead)) return false;
    if (CONFIG.workDays.indexOf(d.getDay()) === -1) return false;
    if (CONFIG.blockedDates.indexOf(toISO(d)) !== -1) return false;
    return true;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return startOfDay(r);
  }

  function toISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatDateJP(iso) {
    var p = iso.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var wd = ["日", "月", "火", "水", "木", "金", "土"];
    return (
      p[0] +
      "年" +
      Number(p[1]) +
      "月" +
      Number(p[2]) +
      "日（" +
      wd[d.getDay()] +
      "）"
    );
  }

  function addMinutes(time, mins) {
    var p = time.split(":");
    var h = Number(p[0]);
    var m = Number(p[1]) + mins;
    if (m >= 60) {
      h++;
      m -= 60;
    }
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }
})();
