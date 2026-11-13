/**
 * SIMBA AI embeddable launcher.
 * <script src="https://HOST/widget/embed.js" data-api-base="https://HOST"></script>
 */
(function () {
  if (window.TaxSimbaConciergeV2 && window.TaxSimbaConciergeV2.__booted) return;

  function resolveApiBase(scriptEl) {
    var attr = scriptEl && scriptEl.getAttribute("data-api-base");
    if (attr && String(attr).trim()) return String(attr).trim().replace(/\/$/, "");
    if (scriptEl && scriptEl.src) {
      try {
        return new URL(scriptEl.src, window.location.href).origin;
      } catch (e) {}
    }
    return (window.location && window.location.origin) || "";
  }

  function boot(scriptEl) {
    if (window.TaxSimbaConciergeV2 && window.TaxSimbaConciergeV2.__booted) return;
    var apiBase = resolveApiBase(scriptEl);
    var STYLE_ID = "simba-ai-launcher";
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        "#simba-launcher{position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:Avenir Next,Segoe UI,Helvetica Neue,Arial,sans-serif}",
        "#simba-btn{appearance:none;border:0;border-radius:999px;background:#0B3D2E;color:#fff;padding:11px 14px 11px 10px;font-weight:600;box-shadow:0 10px 28px rgba(7,40,30,.28);cursor:pointer;display:flex;align-items:center;gap:8px}",
        "#simba-btn img{width:22px;height:22px;border-radius:50%;border:1px solid #C6A75E;background:#fff}",
        "#simba-btn:focus-visible{outline:3px solid #C6A75E;outline-offset:2px}",
        "#simba-panel{position:fixed;right:16px;bottom:70px;width:min(390px,calc(100vw - 20px));height:min(640px,calc(100vh - 100px));border:0;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(7,40,30,.28);background:#fff;z-index:2147483000}",
        "@media (max-width:480px){#simba-panel{right:8px;left:8px;width:auto;bottom:66px;height:min(78vh,640px)}#simba-launcher{right:10px;bottom:10px}}",
      ].join("");
      document.head.appendChild(style);
    }

    document.getElementById("simba-panel")?.remove();
    document.getElementById("simba-launcher")?.remove();

    var launcher = document.createElement("div");
    launcher.id = "simba-launcher";

    var btn = document.createElement("button");
    btn.id = "simba-btn";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "simba-panel");
    btn.innerHTML =
      '<img src="' +
      apiBase +
      '/widget/assets/simba-emblem.svg" alt="" width="22" height="22"/><span>Ask SIMBA</span>';

    var frame = document.createElement("iframe");
    frame.id = "simba-panel";
    frame.title = "SIMBA AI — Your UK Tax Assistant";
    frame.setAttribute("aria-hidden", "true");
    frame.src = apiBase + "/widget/index.html?api=" + encodeURIComponent(apiBase);
    frame.style.display = "none";

    function setOpen(open) {
      frame.style.display = open ? "block" : "none";
      frame.setAttribute("aria-hidden", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.querySelector("span").textContent = open ? "Close" : "Ask SIMBA";
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

    window.TaxSimbaConciergeV2 = window.SimbaAI = {
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

  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot(script);
    });
  } else {
    boot(script);
  }
})();
