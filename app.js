(function () {
  "use strict";

  var fallbackZones = [
    "UTC",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Ho_Chi_Minh",
    "Asia/Jakarta",
    "Asia/Makassar",
    "Asia/Jayapura",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
    "Australia/Sydney",
  ];

  var zoneAliases = {
    UTC: ["utc", "协调世界时", "世界标准时间", "零时区"],
    "Asia/Shanghai": ["中国", "中国大陆", "北京", "上海", "北京时间", "东八区"],
    "Asia/Hong_Kong": ["中国香港", "香港", "港澳"],
    "Asia/Taipei": ["中国台湾", "台湾", "台北"],
    "Asia/Ho_Chi_Minh": ["越南", "胡志明", "河内"],
    "Asia/Saigon": ["越南", "胡志明", "河内", "西贡"],
    "Asia/Jakarta": ["印尼", "印度尼西亚", "雅加达", "爪哇"],
    "Asia/Makassar": ["印尼", "印度尼西亚", "望加锡", "巴厘岛"],
    "Asia/Jayapura": ["印尼", "印度尼西亚", "查亚普拉", "巴布亚"],
    "Asia/Singapore": ["新加坡"],
    "Asia/Tokyo": ["日本", "东京"],
    "Asia/Seoul": ["韩国", "首尔"],
    "Asia/Bangkok": ["泰国", "曼谷"],
    "Asia/Manila": ["菲律宾", "马尼拉"],
    "Asia/Kuala_Lumpur": ["马来西亚", "吉隆坡"],
    "Asia/Kolkata": ["印度", "加尔各答", "新德里"],
    "Europe/London": ["英国", "伦敦"],
    "Europe/Berlin": ["德国", "柏林"],
    "Europe/Paris": ["法国", "巴黎"],
    "America/New_York": ["美国", "纽约", "美东"],
    "America/Los_Angeles": ["美国", "洛杉矶", "美西", "加州"],
    "Australia/Sydney": ["澳大利亚", "澳洲", "悉尼"],
  };

  var elements = {};
  var DateTime = null;
  var timezoneRecords = [];
  var activeNow = new Date();
  var isPaused = false;
  var currentUtcTimeText = "";
  var toastTimer = 0;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();

    if (!window.luxon || !window.luxon.DateTime) {
      showFatalDependencyError();
      return;
    }

    DateTime = window.luxon.DateTime;

    var browserZone = DateTime.local().zoneName || "UTC";
    var zones = getTimeZones(browserZone);
    timezoneRecords = buildTimeZoneRecords(zones);

    elements.globalZone.value = browserZone;
    elements.timestampInput.value = "";

    fillConfiguredDate(DateTime.local().setZone(browserZone));
    bindEvents();
    renderNow();
    updateTimestampConversion();
    updateConfiguredConversion();

    window.setInterval(function () {
      if (!isPaused) {
        activeNow = new Date();
        renderNow();
      }
    }, 1000);
  }

  function cacheElements() {
    elements.globalZone = document.getElementById("global-zone");
    elements.currentSeconds = document.getElementById("current-seconds");
    elements.currentLocalTime = document.getElementById("current-local-time");
    elements.pauseButton = document.getElementById("pause-button");
    elements.copyNowButton = document.getElementById("copy-now-button");
    elements.timestampInput = document.getElementById("timestamp-input");
    elements.timestampResult = document.getElementById("timestamp-result");
    elements.copyConfiguredButton = document.getElementById("copy-configured-button");
    elements.configuredSeconds = document.getElementById("configured-seconds");
    elements.configuredError = document.getElementById("configured-error");
    elements.toast = document.getElementById("toast");
    elements.dateInputs = {
      year: document.getElementById("year-input"),
      month: document.getElementById("month-input"),
      day: document.getElementById("day-input"),
      hour: document.getElementById("hour-input"),
      minute: document.getElementById("minute-input"),
      second: document.getElementById("second-input"),
    };
  }

  function bindEvents() {
    elements.pauseButton.addEventListener("click", function () {
      isPaused = !isPaused;
      if (!isPaused) {
        activeNow = new Date();
      }
      renderNow();
    });

    elements.copyNowButton.addEventListener("click", function () {
      copyText(String(Math.floor(activeNow.getTime() / 1000)), "已复制当前 Unix 秒");
    });

    elements.timestampInput.addEventListener("input", updateTimestampConversion);
    elements.timestampResult.addEventListener("click", function (event) {
      if (!event.target.closest("#copy-utc-button")) {
        return;
      }
      if (!currentUtcTimeText) {
        showToast("没有可复制的 UTC 时间");
        return;
      }
      copyText(currentUtcTimeText, "已复制 UTC 时间");
    });
    elements.globalZone.addEventListener("input", updateAllConversions);
    setupTimeZonePicker(elements.globalZone, updateAllConversions);

    Object.keys(elements.dateInputs).forEach(function (key) {
      elements.dateInputs[key].addEventListener("input", updateConfiguredConversion);
    });

    elements.copyConfiguredButton.addEventListener("click", function () {
      var value = elements.configuredSeconds.textContent.trim();
      if (!value || value === "-") {
        showToast("没有可复制的时间戳");
        return;
      }
      copyText(value, "已复制转换结果");
    });
  }

  function getTimeZones(browserZone) {
    var zones = fallbackZones.slice();

    if (window.Intl && typeof Intl.supportedValuesOf === "function") {
      try {
        zones = Intl.supportedValuesOf("timeZone");
      } catch (error) {
        zones = fallbackZones.slice();
      }
    }

    fallbackZones.forEach(function (zone) {
      if (zones.indexOf(zone) === -1 && isValidIntlZone(zone)) {
        zones.push(zone);
      }
    });

    if (zones.indexOf(browserZone) === -1) {
      zones = [browserZone].concat(zones);
    }

    return zones.filter(Boolean);
  }

  function buildTimeZoneRecords(zones) {
    return zones.map(function (zone) {
      var aliases = zoneAliases[zone] || [];
      var offset = DateTime.local().setZone(zone).toFormat("ZZZZ");
      var parts = zone.split("/");
      var city = parts[parts.length - 1].replace(/_/g, " ");

      return {
        zone: zone,
        label: zone + " (" + offset + ")",
        meta: aliases.length ? aliases.join(" / ") : city,
        searchText: normalizeSearchText(
          [zone, city, offset].concat(aliases).join(" ")
        ),
      };
    });
  }

  function setupTimeZonePicker(input, onSelect) {
    var wrapper = input.closest("[data-zone-picker]");
    var list = wrapper.querySelector(".timezone-list");
    var clearButton = wrapper.querySelector("[data-zone-clear]");

    input.addEventListener("focus", function () {
      input.select();
      renderTimeZoneList(input, list, input.value);
    });

    input.addEventListener("mouseup", function (event) {
      event.preventDefault();
    });

    input.addEventListener("input", function () {
      renderTimeZoneList(input, list, input.value);
    });

    input.addEventListener("keydown", function (event) {
      var active = list.querySelector(".timezone-option.is-active");
      var options = list.querySelectorAll(".timezone-option");

      if (event.key === "Escape") {
        closeTimeZoneList(input, list);
        return;
      }

      if (event.key === "Enter" && active) {
        event.preventDefault();
        selectTimeZone(input, list, active.dataset.zone, onSelect);
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();
      if (!options.length) {
        renderTimeZoneList(input, list, input.value);
        return;
      }

      moveActiveOption(options, active, event.key === "ArrowDown" ? 1 : -1);
    });

    clearButton.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });

    clearButton.addEventListener("click", function () {
      input.value = "";
      input.focus();
      renderTimeZoneList(input, list, "");
      onSelect();
    });

    list.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });

    list.addEventListener("click", function (event) {
      var option = event.target.closest(".timezone-option");
      if (!option) {
        return;
      }
      selectTimeZone(input, list, option.dataset.zone, onSelect);
    });

    document.addEventListener("click", function (event) {
      if (!wrapper.contains(event.target)) {
        closeTimeZoneList(input, list);
      }
    });
  }

  function renderTimeZoneList(input, list, query) {
    var matches = filterTimeZones(query).slice(0, 12);
    input.setAttribute("aria-expanded", "true");
    list.classList.add("is-open");

    if (!matches.length) {
      list.innerHTML = '<div class="timezone-no-result">没有匹配的时区</div>';
      return;
    }

    list.innerHTML = matches
      .map(function (record, index) {
        return (
          '<button class="timezone-option' +
          (index === 0 ? " is-active" : "") +
          '" type="button" role="option" data-zone="' +
          escapeHtml(record.zone) +
          '"><strong>' +
          escapeHtml(record.label) +
          "</strong><span>" +
          escapeHtml(record.meta) +
          "</span></button>"
        );
      })
      .join("");
  }

  function filterTimeZones(query) {
    var normalized = normalizeSearchText(query);
    if (!normalized) {
      return timezoneRecords;
    }

    return timezoneRecords
      .map(function (record) {
        var zoneIndex = normalizeSearchText(record.zone).indexOf(normalized);
        var searchIndex = record.searchText.indexOf(normalized);
        var matchIndex = zoneIndex === -1 ? searchIndex : zoneIndex;

        return {
          record: record,
          rank: matchIndex === -1 ? Number.MAX_SAFE_INTEGER : matchIndex,
        };
      })
      .filter(function (match) {
        return match.rank !== Number.MAX_SAFE_INTEGER;
      })
      .sort(function (a, b) {
        return a.rank - b.rank || a.record.zone.localeCompare(b.record.zone);
      })
      .map(function (match) {
        return match.record;
      });
  }

  function moveActiveOption(options, active, direction) {
    var nextIndex = 0;
    if (active) {
      for (var index = 0; index < options.length; index += 1) {
        if (options[index] === active) {
          nextIndex = index + direction;
          break;
        }
      }
    }

    if (nextIndex < 0) {
      nextIndex = options.length - 1;
    }
    if (nextIndex >= options.length) {
      nextIndex = 0;
    }

    options.forEach(function (option) {
      option.classList.remove("is-active");
    });
    options[nextIndex].classList.add("is-active");
    options[nextIndex].scrollIntoView({ block: "nearest" });
  }

  function selectTimeZone(input, list, zone, onSelect) {
    input.value = zone;
    closeTimeZoneList(input, list);
    onSelect();
  }

  function closeTimeZoneList(input, list) {
    input.setAttribute("aria-expanded", "false");
    list.classList.remove("is-open");
  }

  function fillConfiguredDate(dateTime) {
    elements.dateInputs.year.value = dateTime.year;
    elements.dateInputs.month.value = dateTime.month;
    elements.dateInputs.day.value = dateTime.day;
    elements.dateInputs.hour.value = "";
    elements.dateInputs.minute.value = "";
    elements.dateInputs.second.value = "";
  }

  function renderNow() {
    var millis = activeNow.getTime();
    var seconds = Math.floor(millis / 1000);
    var zone = getSelectedZone();
    var localTime = isValidZone(zone)
      ? DateTime.fromMillis(millis, { zone: zone }).toFormat("yyyy-LL-dd HH:mm:ss ZZZZ")
      : "-";

    elements.currentSeconds.textContent = seconds;
    elements.currentLocalTime.textContent = localTime;
    elements.pauseButton.textContent = isPaused ? "继续" : "暂停";
  }

  function updateTimestampConversion() {
    var rawTimestamp = elements.timestampInput.value.trim();

    elements.timestampResult.classList.remove("is-error");
    currentUtcTimeText = "";

    if (!rawTimestamp) {
      elements.timestampResult.innerHTML = "";
      return;
    }

    if (!/^-?\d+$/.test(rawTimestamp)) {
      renderTimestampError("时间戳只能输入整数秒");
      return;
    }

    var seconds = Number(rawTimestamp);
    if (!Number.isSafeInteger(seconds)) {
      renderTimestampError("时间戳超出安全整数范围");
      return;
    }

    var dateTime = DateTime.fromSeconds(seconds, { zone: "UTC" });
    if (!dateTime.isValid) {
      renderTimestampError(dateTime.invalidExplanation || "无法转换该时间戳");
      return;
    }

    currentUtcTimeText = dateTime.toFormat("yyyy-LL-dd HH:mm:ss");
    elements.timestampResult.innerHTML = resultRowWithCopy(
      "UTC",
      currentUtcTimeText,
      "copy-utc-button",
      "复制"
    );
  }

  function updateConfiguredConversion() {
    var zone = getSelectedZone();
    var parts = readConfiguredParts();

    clearConfiguredResult();

    if (!isValidZone(zone)) {
      renderConfiguredError("请选择有效的 IANA 时区");
      return;
    }

    if (!parts) {
      renderConfiguredError("请完整填写年月日时分秒");
      return;
    }

    var dateTime = DateTime.fromObject(parts, { zone: zone });
    if (!dateTime.isValid || !matchesRequestedParts(dateTime, parts)) {
      renderConfiguredError("输入的日期时间不存在");
      return;
    }

    elements.configuredSeconds.textContent = Math.floor(dateTime.toSeconds());
    elements.copyConfiguredButton.disabled = false;
    elements.configuredError.textContent = "";
    elements.configuredError.classList.remove("is-visible");
  }

  function readConfiguredParts() {
    var values = {};
    var requiredKeys = ["year", "month", "day"];
    var optionalTimeKeys = ["hour", "minute", "second"];

    for (var requiredIndex = 0; requiredIndex < requiredKeys.length; requiredIndex += 1) {
      var key = requiredKeys[requiredIndex];
      var raw = elements.dateInputs[key].value.trim();
      if (raw === "" || !/^-?\d+$/.test(raw)) {
        return null;
      }
      values[key] = Number(raw);
    }

    for (var optionalIndex = 0; optionalIndex < optionalTimeKeys.length; optionalIndex += 1) {
      var optionalKey = optionalTimeKeys[optionalIndex];
      var optionalRaw = elements.dateInputs[optionalKey].value.trim();
      if (optionalRaw === "") {
        values[optionalKey] = 0;
      } else if (/^-?\d+$/.test(optionalRaw)) {
        values[optionalKey] = Number(optionalRaw);
      } else {
        return null;
      }
    }

    if (
      values.year < 1 ||
      values.month < 1 ||
      values.month > 12 ||
      values.day < 1 ||
      values.day > 31 ||
      values.hour < 0 ||
      values.hour > 23 ||
      values.minute < 0 ||
      values.minute > 59 ||
      values.second < 0 ||
      values.second > 59
    ) {
      return null;
    }

    return values;
  }

  function matchesRequestedParts(dateTime, parts) {
    return (
      dateTime.year === parts.year &&
      dateTime.month === parts.month &&
      dateTime.day === parts.day &&
      dateTime.hour === parts.hour &&
      dateTime.minute === parts.minute &&
      dateTime.second === parts.second
    );
  }

  function normalizeZone(zone) {
    return (zone || "").trim() || "UTC";
  }

  function getSelectedZone() {
    return normalizeZone(elements.globalZone.value);
  }

  function updateAllConversions() {
    renderNow();
    updateTimestampConversion();
    updateConfiguredConversion();
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }

  function isValidZone(zone) {
    return DateTime.local().setZone(zone).isValid;
  }

  function isValidIntlZone(zone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch (error) {
      return false;
    }
  }

  function renderTimestampError(message) {
    elements.timestampResult.classList.add("is-error");
    elements.timestampResult.innerHTML =
      '<div class="empty-state">' + escapeHtml(message) + "</div>";
  }

  function renderConfiguredError(message) {
    elements.configuredError.textContent = message;
    elements.configuredError.classList.add("is-visible");
  }

  function clearConfiguredResult() {
    elements.configuredSeconds.textContent = "-";
    elements.copyConfiguredButton.disabled = true;
  }

  function resultRow(label, value) {
    return (
      '<div class="result-row"><span>' +
      escapeHtml(label) +
      "</span><strong>" +
      escapeHtml(value || "-") +
      "</strong></div>"
    );
  }

  function resultRowWithCopy(label, value, buttonId, buttonLabel) {
    return (
      '<div class="result-row"><span>' +
      escapeHtml(label) +
      '</span><div class="inline-result"><strong>' +
      escapeHtml(value || "-") +
      '</strong><button class="button primary compact" id="' +
      escapeHtml(buttonId) +
      '" type="button">' +
      escapeHtml(buttonLabel) +
      "</button></div></div>"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function copyText(text, successMessage) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          showToast(successMessage);
        })
        .catch(function () {
          fallbackCopy(text, successMessage);
        });
      return;
    }

    fallbackCopy(text, successMessage);
  }

  function fallbackCopy(text, successMessage) {
    var input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand("copy");
      showToast(successMessage);
    } catch (error) {
      showToast("复制失败，请手动复制");
    } finally {
      document.body.removeChild(input);
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 1800);
  }

  function showFatalDependencyError() {
    document.body.classList.add("is-fatal");
    var panels = document.querySelectorAll(".tool-panel");
    panels.forEach(function (panel) {
      panel.innerHTML =
        '<div class="empty-state is-error">Luxon 加载失败，请检查网络后刷新页面。</div>';
    });
  }
})();
