/**
 * VSB Consulting — Googleカレンダー空き枠API
 * プロジェクトのタイムゾーン: Asia/Tokyo
 */

var CONFIG = {
  /** 予定の重複チェックに使うカレンダー（大学・太極拳など） */
  CALENDAR_IDS: [
    "primary",
    // "xxxx@group.calendar.google.com",
  ],
  /** 日本の祝日（Google公式）— 土日祝を除くため */
  HOLIDAY_CALENDAR_ID: "ja.japanese#holiday@group.v.calendar.google.com",
  /** 平日のみ: 月=1 … 金=5 */
  WORK_DAYS: [1, 2, 3, 4, 5],
  /** 業務時間 */
  BUSINESS_START: { h: 9, m: 0 },
  BUSINESS_END: { h: 19, m: 0 },
  /** 無料相談1回あたりの時間（分） */
  SLOT_MINUTES: 60,
  /** 相談開始時刻の候補（業務時間内・1時間枠） */
  SLOTS: [
    "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  ],
  TIMEZONE: "Asia/Tokyo",
};

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  try {
    var start = params.start;
    var end = params.end || start;
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      throw new Error("start parameter required (YYYY-MM-DD)");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new Error("end parameter invalid");
    }

    var result = getAvailability(start, end);
    var json = JSON.stringify(result);
    var callback = params.callback;

    if (callback && /^[a-zA-Z_$][\w$]*$/.test(callback)) {
      return ContentService.createTextOutput(callback + "(" + json + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(json).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    var errJson = JSON.stringify({
      ok: false,
      error: String(err.message || err),
    });
    var cb = params.callback;
    if (cb && /^[a-zA-Z_$][\w$]*$/.test(cb)) {
      return ContentService.createTextOutput(cb + "(" + errJson + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errJson).setMimeType(
      ContentService.MimeType.JSON
    );
  }
}

function getAvailability(startIso, endIso) {
  var rangeStart = parseJST(startIso, 0, 0, 0);
  var rangeEnd = parseJST(endIso, 23, 59, 59);
  var allEvents = fetchCalendarEvents(rangeStart, rangeEnd);
  var days = {};
  var cursor = parseJST(startIso, 0, 0, 0);

  while (cursor <= rangeEnd) {
    var dayIso = formatIsoDate(cursor);
    days[dayIso] = getAvailableSlotsForDay(dayIso, allEvents);
    cursor = addDays(cursor, 1);
  }

  return {
    ok: true,
    timezone: CONFIG.TIMEZONE,
    slotMinutes: CONFIG.SLOT_MINUTES,
    slots: CONFIG.SLOTS,
    businessHours: "09:00-19:00",
    workDays: "月〜金（祝日除く）",
    days: days,
  };
}

function getAvailableSlotsForDay(dayIso, allEvents) {
  var dayStart = parseJST(dayIso, 0, 0, 0);

  if (CONFIG.WORK_DAYS.indexOf(dayStart.getDay()) === -1) {
    return [];
  }

  if (isJapaneseHoliday(dayIso)) {
    return [];
  }

  var dayEnd = parseJST(dayIso, 23, 59, 59);
  var dayEvents = allEvents.filter(function (ev) {
    return eventTouchesDay(ev, dayStart, dayEnd);
  });

  if (dayEvents.some(function (ev) { return ev.isAllDayEvent(); })) {
    return [];
  }

  var busy = buildBusyIntervals(dayEvents);
  var bizEnd = parseJST(
    dayIso,
    CONFIG.BUSINESS_END.h,
    CONFIG.BUSINESS_END.m,
    0
  );
  var available = [];

  CONFIG.SLOTS.forEach(function (slot) {
    var parts = slot.split(":");
    var slotStart = parseJST(dayIso, Number(parts[0]), Number(parts[1]), 0);
    var slotEnd = addMinutes(slotStart, CONFIG.SLOT_MINUTES);
    if (slotEnd > bizEnd) return;
    if (!overlapsAny(slotStart, slotEnd, busy)) {
      available.push(slot);
    }
  });

  return available;
}

/** カレンダー予定と重なる時間帯のみブロック（移動バッファなし） */
function buildBusyIntervals(dayEvents) {
  var timed = dayEvents.filter(function (ev) {
    return !ev.isAllDayEvent();
  });

  return timed.map(function (ev) {
    return { start: ev.getStartTime(), end: ev.getEndTime() };
  });
}

function isJapaneseHoliday(dayIso) {
  if (!CONFIG.HOLIDAY_CALENDAR_ID) return false;
  var cal = CalendarApp.getCalendarById(CONFIG.HOLIDAY_CALENDAR_ID);
  if (!cal) return false;
  var dayStart = parseJST(dayIso, 0, 0, 0);
  var dayEnd = parseJST(dayIso, 23, 59, 59);
  var events = cal.getEvents(dayStart, dayEnd);
  return events.length > 0;
}

function fetchCalendarEvents(rangeStart, rangeEnd) {
  var merged = [];
  var seen = {};

  CONFIG.CALENDAR_IDS.forEach(function (calId) {
    var cal =
      CalendarApp.getCalendarById(calId) ||
      (calId === "primary" ? CalendarApp.getDefaultCalendar() : null);
    if (!cal) {
      Logger.log("Calendar not found: " + calId);
      return;
    }
    cal.getEvents(rangeStart, rangeEnd).forEach(function (ev) {
      var key =
        ev.getId() +
        "_" +
        ev.getStartTime().getTime() +
        "_" +
        ev.getEndTime().getTime();
      if (!seen[key]) {
        seen[key] = true;
        merged.push(ev);
      }
    });
  });

  return merged;
}

function eventTouchesDay(ev, dayStart, dayEnd) {
  if (ev.isAllDayEvent()) {
    return ev.getStartTime() < dayEnd && ev.getEndTime() > dayStart;
  }
  return ev.getStartTime() < dayEnd && ev.getEndTime() > dayStart;
}

function overlapsAny(slotStart, slotEnd, intervals) {
  for (var i = 0; i < intervals.length; i++) {
    if (slotStart < intervals[i].end && slotEnd > intervals[i].start) {
      return true;
    }
  }
  return false;
}

function parseJST(isoDate, h, m, s) {
  var p = isoDate.split("-");
  return new Date(
    Number(p[0]),
    Number(p[1]) - 1,
    Number(p[2]),
    h,
    m,
    s || 0
  );
}

function formatIsoDate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function addDays(d, n) {
  var r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

function addMinutes(d, mins) {
  return new Date(d.getTime() + mins * 60 * 1000);
}

function testAvailability() {
  var result = getAvailability("2026-05-01", "2026-05-31");
  Logger.log(JSON.stringify(result, null, 2));
}
