/**
 * TaxSimba SIMBA embed launcher
 * Premium floating “Ask SIMBA / AI Tax Assistant” + session-dismissible welcome card.
 * Opens compact chat panel (chat.html). Full workspace remains at /widget/index.html.
 */
(function () {
  "use strict";

  if (window.__SIMBA_EMBED_LOADED__) return;
  window.__SIMBA_EMBED_LOADED__ = true;

  var script =
    document.currentScript ||
    (function () {
      var list = document.getElementsByTagName("script");
      for (var i = list.length - 1; i >= 0; i--) {
        if ((list[i].src || "").indexOf("embed.js") !== -1) return list[i];
      }
      return null;
    })();

  var API =
    (script && script.getAttribute("data-api-base")) ||
    (script && script.src ? new URL(script.src).origin : window.location.origin);
  var POSITION = (script && script.getAttribute("data-position")) || "bottom-right";
  var WELCOME_KEY = "simba_welcome_dismissed_v1";
  var OPEN_KEY = "simba_panel_open_v1";

  var BRAND = "#006b3c";
  var ACTION = "#078a4b";
  var DEEP = "#004d2c";

  function css() {
    return (
      "#simba-root{all:initial;font-family:Public Sans,Segoe UI,system-ui,sans-serif;}" +
      "#simba-root *{box-sizing:border-box;font-family:inherit;}" +
      "#simba-root{position:fixed;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:none;" +
      (POSITION.indexOf("left") >= 0 ? "left:16px;" : "right:16px;") +
      "bottom:calc(16px + env(safe-area-inset-bottom,0px));}" +
      "#simba-root > *{pointer-events:auto;}" +
      "#simba-welcome{width:min(320px,calc(100vw - 32px));background:#fff;color:" +
      DEEP +
      ";border-radius:16px;box-shadow:0 12px 32px rgba(0,77,44,.18);padding:16px 16px 14px;border:1px solid #e3e7e4;}" +
      "#simba-welcome[hidden]{display:none!important;}" +
      "#simba-welcome .sw-close{appearance:none;border:0;background:transparent;color:#626a65;width:32px;height:32px;border-radius:8px;cursor:pointer;position:absolute;top:8px;right:8px;font-size:18px;line-height:1;}" +
      "#simba-welcome .sw-close:hover{background:#f0f4f1;color:" +
      DEEP +
      ";}" +
      "#simba-welcome .sw-close:focus-visible{outline:3px solid rgba(7,138,75,.35);outline-offset:2px;}" +
      "#simba-welcome{position:relative;}" +
      "#simba-welcome .sw-title{margin:0 28px 8px 0;font-weight:700;font-size:1.02rem;color:" +
      DEEP +
      ";line-height:1.35;}" +
      "#simba-welcome .sw-lead{margin:0 0 10px;font-size:.92rem;color:" +
      DEEP +
      ";line-height:1.4;}" +
      "#simba-welcome ul{margin:0;padding:0;list-style:none;}" +
      "#simba-welcome li{position:relative;padding:4px 0 4px 22px;font-size:.88rem;color:" +
      DEEP +
      ";line-height:1.4;}" +
      "#simba-welcome li::before{content:'✓';position:absolute;left:0;top:4px;color:" +
      ACTION +
      ";font-weight:700;}" +
      "#simba-launcher{appearance:none;border:0;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-width:132px;min-height:56px;padding:10px 18px;border-radius:999px;background:linear-gradient(160deg," +
      BRAND +
      " 0%," +
      DEEP +
      " 100%);color:#fff;box-shadow:0 10px 24px rgba(0,77,44,.28);text-align:left;}" +
      "#simba-launcher:hover{filter:brightness(1.05);}" +
      "#simba-launcher:focus-visible{outline:3px solid rgba(7,138,75,.45);outline-offset:3px;}" +
      "#simba-launcher .sl-main{font-weight:800;font-size:.95rem;letter-spacing:.01em;line-height:1.1;}" +
      "#simba-launcher .sl-sub{font-weight:500;font-size:.68rem;opacity:.92;line-height:1.1;}" +
      "#simba-panel{width:min(400px,calc(100vw - 24px));height:min(640px,calc(100vh - 96px));border:0;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(0,40,24,.28);background:#fff;display:none;}" +
      "#simba-panel.open{display:block;}" +
      "@media (max-width:640px){" +
      "#simba-root{right:12px;left:12px;align-items:stretch;bottom:calc(12px + env(safe-area-inset-bottom,0px));}" +
      "#simba-welcome{width:100%;max-width:none;}" +
      "#simba-launcher{align-self:flex-end;}" +
      "#simba-panel{position:fixed;inset:0;width:100vw;height:100%;max-height:100%;border-radius:0;z-index:2147483001;}" +
      "#simba-root.panel-open #simba-welcome,#simba-root.panel-open #simba-launcher{display:none!important;}" +
      "}"
    );
  }

  function welcomeDismissed() {
    try {
      return sessionStorage.getItem(WELCOME_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  var welcomeEl = null;

  function dismissWelcome() {
    try {
      sessionStorage.setItem(WELCOME_KEY, "1");
    } catch (_) {}
    if (welcomeEl) welcomeEl.hidden = true;
  }

  function inject() {
    var style = document.createElement("style");
    style.id = "simba-embed-style";
    style.textContent = css();
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.id = "simba-root";
    root.setAttribute("data-simba-embed", "1");

    // Welcome card — appear once per visitor session
    welcomeEl = document.createElement("aside");
    welcomeEl.id = "simba-welcome";
    welcomeEl.setAttribute("role", "dialog");
    welcomeEl.setAttribute("aria-label", "Ask SIMBA welcome");
    welcomeEl.innerHTML =
      '<button type="button" class="sw-close" aria-label="Close welcome message">&times;</button>' +
      '<p class="sw-title">✨ Need help with your tax?</p>' +
      '<p class="sw-lead">Ask SIMBA, your AI Tax Assistant.</p>' +
      "<ul>" +
      "<li>Get answers to UK tax questions</li>" +
      "<li>Find the right TaxSimba service</li>" +
      "<li>Understand deadlines and next steps</li>" +
      "</ul>";
    if (welcomeDismissed()) welcomeEl.hidden = true;
    welcomeEl.querySelector(".sw-close").addEventListener("click", dismissWelcome);

    // Premium two-line launcher
    var launcher = document.createElement("button");
    launcher.id = "simba-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Ask SIMBA AI Tax Assistant");
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML =
      '<span class="sl-main">Ask SIMBA</span><span class="sl-sub">AI Tax Assistant</span>';

    var panel = document.createElement("iframe");
    panel.id = "simba-panel";
    panel.title = "Ask SIMBA AI Tax Assistant";
    panel.setAttribute("allow", "clipboard-write");
    panel.setAttribute("loading", "lazy");

    function panelSrc() {
      var u = new URL("/widget/chat.html", API.replace(/\/$/, "") + "/");
      // When API is absolute origin hosting the widget
      try {
        u = new URL((API.replace(/\/$/, "") || window.location.origin) + "/widget/chat.html");
      } catch (_) {}
      u.searchParams.set("api", API.replace(/\/$/, ""));
      u.searchParams.set("site", window.location.origin);
      return u.toString();
    }

    function openPanel() {
      dismissWelcome();
      if (!panel.getAttribute("src")) panel.setAttribute("src", panelSrc());
      panel.classList.add("open");
      root.classList.add("panel-open");
      launcher.setAttribute("aria-expanded", "true");
      try {
        sessionStorage.setItem(OPEN_KEY, "1");
      } catch (_) {}
    }

    function closePanel() {
      panel.classList.remove("open");
      root.classList.remove("panel-open");
      launcher.setAttribute("aria-expanded", "false");
      try {
        sessionStorage.removeItem(OPEN_KEY);
      } catch (_) {}
      launcher.focus();
    }

    launcher.addEventListener("click", function () {
      if (panel.classList.contains("open")) closePanel();
      else openPanel();
    });

    window.addEventListener("message", function (ev) {
      var data = ev && ev.data;
      if (!data || data.source !== "simba-embed") return;
      if (data.type === "close") closePanel();
      if (data.type === "open-workspace" && data.url) {
        // Optional: host can listen; default leave iframe expand to open new tab from panel
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) {
        closePanel();
      }
    });

    root.appendChild(welcomeEl);
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    window.__SIMBA_EMBED__ = {
      open: openPanel,
      close: closePanel,
      dismissWelcome: dismissWelcome,
      apiBase: API,
    };

    // Do not auto-reopen panel across pages; welcome only shows if not dismissed
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
