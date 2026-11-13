/**
 * TaxSimba AI Tax Concierge V2 — embeddable launcher.
 * Usage (does not alter host page design beyond a floating launcher):
 *   <script src="https://HOST/widget/embed.js" data-api-base="https://HOST"></script>
 */
(function () {
  if (window.TaxSimbaConciergeV2 && window.TaxSimbaConciergeV2.__booted) return;

  function resolveApiBase(scriptEl) {
    var attr = scriptEl && scriptEl.getAttribute("data-api-base");
    if (attr && String(attr).trim()) return String(attr).trim().replace(/\/$/, "");
    if (scriptEl && scriptEl.src) {
      try {
        return new URL(scriptEl.src, window.location.href).origin;
      } catch (e) {
        /* fall through */
      }
    }
    return (window.location && window.location.origin) || "";
  }

  function boot(scriptEl) {
    if (window.TaxSimbaConciergeV2 && window.TaxSimbaConciergeV2.__booted) return;
    var apiBase = resolveApiBase(scriptEl);

    var STYLE_ID = "taxsimba-concierge-v2-launcher";
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        "#ts-concierge-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif}",
        "#ts-concierge-btn{appearance:none;border:0;border-radius:999px;background:#0A2A6A;color:#fff;padding:12px 18px;font-weight:600;box-shadow:0 10px 30px rgba(10,42,106,.28);cursor:pointer}",
        "#ts-concierge-btn:focus-visible{outline:3px solid #99f6e4;outline-offset:2px}",
        "#ts-concierge-panel{position:fixed;right:20px;bottom:76px;width:min(400px,calc(100vw - 24px));height:min(640px,calc(100vh - 110px));border:0;border-radius:16px;overflow:hidden;box-shadow:0 22px 60px rgba(7,30,77,.28);background:#fff;z-index:2147483000}",
        "@media (max-width:480px){#ts-concierge-panel{right:12px;left:12px;width:auto;bottom:72px;height:min(78vh,640px)}#ts-concierge-launcher{right:12px;bottom:12px}}",
      ].join("");
      document.head.appendChild(style);
    }

    var existing = document.getElementById("ts-concierge-panel");
    if (existing) existing.remove();
    var oldBtn = document.getElementById("ts-concierge-btn");
    if (oldBtn && oldBtn.parentNode) oldBtn.parentNode.remove();

    var launcher = document.createElement("div");
    launcher.id = "ts-concierge-launcher";

    var btn = document.createElement("button");
    btn.id = "ts-concierge-btn";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "ts-concierge-panel");
    btn.textContent = "Ask TaxSimba";

    var frame = document.createElement("iframe");
    frame.id = "ts-concierge-panel";
    frame.title = "TaxSimba AI Tax Concierge";
    frame.setAttribute("aria-hidden", "true");
    frame.src = apiBase + "/widget/index.html?api=" + encodeURIComponent(apiBase);
    frame.style.display = "none";

    function setOpen(open) {
      frame.style.display = open ? "block" : "none";
      frame.setAttribute("aria-hidden", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Close chat" : "Ask TaxSimba";
    }

    function onToggle(ev) {
      if (ev) ev.preventDefault();
      var currentlyHidden = frame.style.display === "none" || frame.style.display === "";
      setOpen(currentlyHidden);
    }
    btn.addEventListener("click", onToggle);
    btn.onclick = onToggle;

    function mount() {
      if (!document.body) return;
      document.body.appendChild(frame);
      launcher.appendChild(btn);
      document.body.appendChild(launcher);
    }

    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);

    window.TaxSimbaConciergeV2 = {
      __booted: true,
      open: function () {
        setOpen(true);
      },
      close: function () {
        setOpen(false);
      },
      apiBase: apiBase,
    };
  }

  var script =
    document.currentScript ||
    document.querySelector('script[src*="embed.js"]');

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot(script);
    });
  } else {
    boot(script);
  }
})();
