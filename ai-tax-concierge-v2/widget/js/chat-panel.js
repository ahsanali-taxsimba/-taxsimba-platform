(function () {
  "use strict";

  var qs = new URLSearchParams(window.location.search);
  var API = (qs.get("api") || window.location.origin).replace(/\/$/, "");
  var SITE = qs.get("site") || window.location.origin;

  var SESSION_KEY = "simba_embed_session_v1";
  var HISTORY_KEY = "simba_embed_history_v1";

  var body = document.getElementById("sp-body");
  var messagesEl = document.getElementById("sp-messages");
  var intro = document.querySelector(".sp-intro");
  var form = document.getElementById("sp-form");
  var input = document.getElementById("sp-input");
  var sendBtn = document.getElementById("sp-send");
  var live = document.getElementById("sp-live");
  var closeBtn = document.getElementById("sp-close");
  var expandBtn = document.getElementById("sp-expand");
  var workspaceLink = document.getElementById("sp-workspace");

  var busy = false;
  var journeyState = null;
  var history = loadHistory();

  function postParent(type, extra) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          Object.assign({ source: "simba-embed", type: type }, extra || {}),
          "*"
        );
      }
    } catch (_) {}
  }

  function sessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id =
          "emb_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (_) {
      return "emb_anon";
    }
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-40) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40)));
    } catch (_) {}
  }

  function setLive(msg) {
    if (live) live.textContent = msg || "";
  }

  function scrollBottom() {
    if (body) body.scrollTop = body.scrollHeight;
  }

  function hideIntro() {
    if (intro) intro.hidden = true;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveUrl(path) {
    if (!path) return SITE;
    if (/^https?:\/\//i.test(path)) return path;
    try {
      return new URL(path, SITE).toString();
    } catch (_) {
      return SITE.replace(/\/$/, "") + path;
    }
  }

  function workspaceUrl() {
    var u = new URL("/widget/index.html", window.location.origin);
    u.searchParams.set("api", API);
    u.searchParams.set("embed", "1");
    return u.toString();
  }

  function openWorkspace() {
    postParent("open-workspace", { url: workspaceUrl() });
    try {
      window.open(workspaceUrl(), "_blank", "noopener,noreferrer");
    } catch (_) {}
  }

  function appendUser(text) {
    var wrap = document.createElement("div");
    wrap.className = "sp-msg user";
    wrap.innerHTML = '<div class="sp-bubble">' + escapeHtml(text) + "</div>";
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  function appendAssistant(payload) {
    var wrap = document.createElement("div");
    wrap.className = "sp-msg assistant";
    var html = '<div class="sp-bubble">' + escapeHtml(payload.reply || "") + "</div>";

    if (payload.journey && payload.journey.current && payload.journey.current.options) {
      var opts = payload.journey.current.options;
      if (opts.length) {
        html += '<div class="sp-pkgs" role="group" aria-label="Guided options">';
        opts.forEach(function (opt) {
          html +=
            '<button type="button" class="sp-quick-btn sp-option" data-option="' +
            escapeHtml(opt.id) +
            '">' +
            escapeHtml(opt.label) +
            "</button>";
        });
        html += "</div>";
      }
    }

    var packages = (payload.packages || []).slice(0, 3);
    if (packages.length) {
      html += '<div class="sp-pkgs" aria-label="Optional packages">';
      packages.forEach(function (p) {
        var price = Number(p.price_gbp);
        var priceLabel = Number.isFinite(price)
          ? Number.isInteger(price)
            ? "£" + price
            : "£" + price.toFixed(2)
          : p.price_display || "";
        html +=
          '<div class="sp-pkg"><strong>' +
          escapeHtml(p.name || p.code || "Package") +
          "</strong> — " +
          escapeHtml(priceLabel) +
          (p.billing ? " · " + escapeHtml(p.billing) : "") +
          (p.vat_note ? '<div style="margin-top:4px;color:#626a65">' + escapeHtml(p.vat_note) + "</div>" : "") +
          "</div>";
      });
      html += "</div>";
    }

    var routes = (payload.routes || []).slice(0, 2).filter(function (r) {
      return r && r.url;
    });
    if (routes.length) {
      html += '<div class="sp-pkgs">';
      routes.forEach(function (r) {
        html +=
          '<a href="' +
          escapeHtml(resolveUrl(r.url)) +
          '" target="_blank" rel="noopener noreferrer" style="display:block;color:#006b3c;font-weight:600;font-size:0.85rem;margin-top:4px">' +
          escapeHtml(r.label || r.title || "Continue on TaxSimba") +
          "</a>";
      });
      html += "</div>";
    }

    var calculators = (payload.calculators || []).slice(0, 2).filter(function (c) {
      return c && c.url;
    });
    if (calculators.length) {
      html += '<div class="sp-pkgs">';
      calculators.forEach(function (c) {
        html +=
          '<a href="' +
          escapeHtml(resolveUrl(c.url)) +
          '" target="_blank" rel="noopener noreferrer" style="display:block;color:#006b3c;font-weight:600;font-size:0.85rem;margin-top:4px">' +
          escapeHtml(c.title || "Tax calculator") +
          "</a>";
      });
      html += "</div>";
    }

    var followUps = (payload.follow_ups || []).slice(0, 2);
    if (followUps.length) {
      html += '<div class="sp-pkgs">';
      followUps.forEach(function (f) {
        html +=
          '<button type="button" class="sp-quick-btn sp-follow" data-follow="' +
          escapeHtml(f) +
          '">' +
          escapeHtml(f) +
          "</button>";
      });
      html += "</div>";
    }

    if (payload.consultation_hint) {
      html +=
        '<div class="sp-pkg">' +
        escapeHtml(payload.consultation_hint) +
        '<div style="margin-top:6px"><button type="button" class="sp-quick-btn sp-follow" data-follow="I want to book a £99 accountant consultation for 30 minutes.">Ask about £99 consultation</button></div></div>';
    }

    wrap.innerHTML = html;
    messagesEl.appendChild(wrap);
    wrap.querySelectorAll(".sp-option").forEach(function (btn) {
      btn.addEventListener("click", function () {
        sendChat(btn.textContent, { journey_option_id: btn.getAttribute("data-option") });
      });
    });
    wrap.querySelectorAll(".sp-follow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        sendChat(btn.getAttribute("data-follow") || btn.textContent);
      });
    });
    scrollBottom();
  }

  function appendError(text) {
    var wrap = document.createElement("div");
    wrap.className = "sp-msg assistant";
    wrap.innerHTML = '<div class="sp-bubble error" role="alert">' + escapeHtml(text) + "</div>";
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  function appendLoading() {
    var wrap = document.createElement("div");
    wrap.className = "sp-msg assistant";
    wrap.id = "sp-loading";
    wrap.innerHTML = '<div class="sp-bubble loading">SIMBA is thinking…</div>';
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  async function sendChat(text, extra) {
    if (busy || !text || !String(text).trim()) return;
    busy = true;
    sendBtn.disabled = true;
    hideIntro();
    var userText = String(text).trim();
    appendUser(userText);
    history.push({ role: "user", content: userText });
    saveHistory();
    var loading = appendLoading();
    setLive("SIMBA is thinking");

    try {
      var payload = Object.assign(
        {
          session_id: sessionId(),
          message: userText,
          history: history.slice(0, -1).slice(-12),
          journey_state: journeyState,
          metadata: {
            channel: "embed_compact",
            site_origin: SITE,
          },
        },
        extra || {}
      );
      var res = await fetch(API + "/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      var data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
      if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
      if (!res.ok) {
        var errMsg =
          (data && data.error && data.error.message) ||
          (data && (data.message || data.detail)) ||
          "Sorry — SIMBA could not respond just now. Please try again.";
        if (typeof errMsg !== "string") errMsg = "Sorry — SIMBA could not respond just now.";
        appendError(errMsg);
        setLive("Error");
        return;
      }
      journeyState = data.journey || null;
      appendAssistant(data);
      history.push({ role: "assistant", content: data.reply || "" });
      saveHistory();
      setLive("Reply ready");
    } catch (e) {
      if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
      appendError(
        "Connection error. Check that the SIMBA API is reachable, then try again."
      );
      setLive("Connection error");
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function runAction(action) {
    var map = {
      sa: "I need help with Self Assessment. What should I know and which TaxSimba package fits?",
      mtd: "I need help with Making Tax Digital for Income Tax. Explain the thresholds and which MTD package fits.",
      package:
        "Help me choose the right TaxSimba package. Ask one question at a time about my situation.",
      consult: "I want to book a £99 accountant consultation for 30 minutes.",
      ask: null,
    };
    if (action === "ask") {
      hideIntro();
      input.focus();
      setLive("Type your tax question");
      return;
    }
    if (map[action]) sendChat(map[action]);
  }

  if (history.length) {
    hideIntro();
    history.forEach(function (m) {
      if (m.role === "user") appendUser(m.content);
      else if (m.role === "assistant")
        appendAssistant({ reply: m.content, packages: [], routes: [], follow_ups: [] });
    });
  }

  document.querySelectorAll(".sp-quick-btn[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      runAction(btn.getAttribute("data-action"));
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = input.value;
    input.value = "";
    sendChat(t);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  closeBtn.addEventListener("click", function () {
    postParent("close");
  });
  expandBtn.addEventListener("click", openWorkspace);
  workspaceLink.addEventListener("click", function (e) {
    e.preventDefault();
    openWorkspace();
  });

  postParent("ready");
  input.focus();
})();
