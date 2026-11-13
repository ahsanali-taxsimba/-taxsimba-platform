(() => {
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const API_BASE = (params.get("api") || root.dataset.apiBase || "").replace(/\/$/, "");
  const WEBSITE = "https://www.taxsimba.co.uk";

  const TOPICS = [
    { id: "sa", title: "Self Assessment", blurb: "Who needs to file and key deadlines", journey: "first_time", icon: "file" },
    { id: "mtd", title: "Making Tax Digital", blurb: "Thresholds, start dates and plans", journey: "mtd", icon: "calendar" },
    { id: "landlord", title: "Landlords", blurb: "Rental income and property tax", journey: "landlord", icon: "home" },
    { id: "freelancer_cis", title: "Freelancers & CIS", blurb: "Self-employed and construction tax", journey: "freelancer", icon: "briefcase" },
    { id: "vat", title: "VAT", blurb: "£90k threshold, 12-month & 30-day tests", message: "Explain UK VAT registration using the £90,000 threshold, the rolling 12-month test and the forward-looking 30-day test.", icon: "percent" },
    { id: "calculators", title: "Tax Calculators", blurb: "Estimate tax with TaxSimba tools", message: "Which TaxSimba tax calculators should I use for Income Tax, NI or rental income?", icon: "calc" },
  ];

  const SUGGESTIONS = [
    { label: "Do I need to file a tax return?", message: "Do I need to send a Self Assessment tax return?" },
    { label: "When is the SA deadline?", message: "When is the Self Assessment online filing deadline?" },
    { label: "What do packages cost?", message: "What Self Assessment and MTD packages does TaxSimba offer?" },
  ];

  const FAQ_ITEMS = [
    { q: "Do I need Self Assessment?", message: "Do I need to send a Self Assessment tax return?" },
    { q: "What is Making Tax Digital?", message: "What is Making Tax Digital for Income Tax and who does it apply to?" },
    { q: "VAT registration — 12 months vs 30 days?", message: "Explain UK VAT registration using the £90,000 threshold, the rolling 12-month test and the forward-looking 30-day test." },
    { q: "I don’t want to buy anything", message: "I don't want to buy anything. Just explain the Self Assessment online filing deadline for 2025-26." },
    { q: "I’m an existing TaxSimba client", message: "I am an existing TaxSimba client. How do I contact my assigned accountant?" },
  ];

  const ICONS = {
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="3" y1="13" x2="21" y2="13"/></svg>',
    percent: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
    calc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="12" y1="16" x2="12" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>',
  };

  const state = {
    sessionId: crypto.randomUUID(),
    history: [],
    journey: null,
    bootstrap: null,
    busy: false,
    view: "welcome",
    panel: "chat",
  };

  const els = {
    shell: document.querySelector(".ts-shell"),
    body: document.getElementById("ts-body"),
    year: document.getElementById("ts-year"),
    mode: document.getElementById("ts-mode"),
    form: document.getElementById("ts-form"),
    input: document.getElementById("ts-input"),
    send: document.getElementById("ts-send"),
    live: document.getElementById("ts-live"),
    del: document.getElementById("ts-delete"),
    topicsBtn: document.getElementById("ts-topics-btn"),
    navToggle: document.getElementById("ts-nav-toggle"),
    sidebar: document.getElementById("ts-sidebar"),
    backdrop: document.getElementById("ts-sidebar-backdrop"),
  };

  function api(path, options = {}) {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 35000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { timeoutMs: _ignored, ...fetchOpts } = options;
    return fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      ...fetchOpts,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data?.error?.message || data?.detail?.[0]?.msg || data?.detail || `Request failed (${res.status})`;
          throw new Error(typeof msg === "string" ? msg : "Something went wrong");
        }
        return data;
      })
      .catch((err) => {
        if (err && err.name === "AbortError") {
          throw new Error("SIMBA timed out. Please retry in a moment.");
        }
        if (!navigator.onLine) {
          throw new Error("You appear to be offline. Check your connection and retry.");
        }
        throw err instanceof Error ? err : new Error("Unable to reach SIMBA.");
      })
      .finally(() => clearTimeout(timer));
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setBusy(busy) {
    state.busy = busy;
    els.send.disabled = busy;
    els.input.disabled = busy;
  }

  function announce(text) {
    els.live.textContent = text;
  }

  function setNavOpen(open) {
    els.shell?.classList.toggle("nav-open", open);
    if (els.navToggle) els.navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (els.backdrop) els.backdrop.hidden = !open;
  }

  function setView(view) {
    state.view = view;
    if (els.topicsBtn) els.topicsBtn.hidden = view !== "chat";
    els.shell?.classList.toggle("is-chat", view === "chat");
  }

  function enterChatView() {
    if (state.view === "welcome") {
      els.body.innerHTML = "";
      setView("chat");
    }
  }

  function showPanel(panelId) {
    state.panel = panelId;
    document.querySelectorAll(".ts-panel").forEach((p) => {
      const active = p.dataset.panelView === panelId;
      p.classList.toggle("is-active", active);
      p.hidden = !active;
    });
    document.querySelectorAll(".ts-nav-item, .ts-mnav").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.panel === panelId);
    });
    setNavOpen(false);
    track("panel_view", { panel: panelId });
    if (panelId === "chat") {
      els.input?.focus();
    } else {
      renderStaticPanel(panelId);
    }
  }

  function websiteUrl(path) {
    return `${WEBSITE}${path}`;
  }

  function renderStaticPanel(panelId) {
    const boot = state.bootstrap || {};
    const packages = boot.packages || {};
    const routes = boot.routes?.routes || [];
      const calcs = boot.calculators?.items || [];

    if (panelId === "guided") {
      const topicsHtml = TOPICS.map((t) => {
        const attrs = t.journey
          ? `data-topic-journey="${escapeHtml(t.journey)}" data-topic-label="${escapeHtml(t.title)}"`
          : `data-topic-message="${escapeHtml(t.message || "")}"`;
        return `<button type="button" class="ts-topic" ${attrs}>
          <span class="ts-topic-icon">${ICONS[t.icon] || ""}</span>
          <strong>${escapeHtml(t.title)}</strong>
          <small>${escapeHtml(t.blurb)}</small>
        </button>`;
      }).join("");
      document.getElementById("ts-panel-guided").innerHTML = `
        <div class="ts-panel-scroll">
          <h2>Guided Help</h2>
          <p class="ts-lead">Choose a topic. SIMBA will ask only the clarifying questions needed, then explain the rules in plain English.</p>
          <div class="ts-topics">${topicsHtml}</div>
        </div>`;
      return;
    }

    if (panelId === "calculators") {
      let items = calcs;
      if (!items.length) {
        // Fallback from routes registry calculator entries
        items = routes.filter((r) => r.kind === "calculator").map((r) => ({
          title: r.label,
          path: r.path,
          url_status: r.status,
          description: "TaxSimba calculator",
        }));
      }
      const cards = items.map((c) => {
        const href = c.url || (c.path ? websiteUrl(c.path) : null);
        const title = href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" data-calc-id="${escapeHtml(c.id || c.path || "")}">${escapeHtml(c.title || c.label)}</a>`
          : `<strong>${escapeHtml(c.title || c.label)}</strong>`;
        const status = (c.url_status || c.status || "") === "live_verified"
          ? `<span class="ts-status-pill ok">Verified link</span>`
          : `<span class="ts-status-pill">${escapeHtml(c.url_status || c.status || "configured")}</span>`;
        return `<div class="ts-list-card">${title}
          <div class="ts-note">${escapeHtml(c.description || c.path || "")}</div>${status}</div>`;
      }).join("");
      document.getElementById("ts-panel-calculators").innerHTML = `
        <div class="ts-panel-scroll">
          <h2>Tax Calculators</h2>
          <p class="ts-lead">Seventeen TaxSimba calculators. Links open on taxsimba.co.uk — SIMBA does not run the calculators itself.</p>
          <div class="ts-list-card"><a href="${websiteUrl("/calculators")}" target="_blank" rel="noopener noreferrer">Open calculators hub</a></div>
          ${cards || '<p class="ts-lead">Calculator catalogue loading…</p>'}
        </div>`;
      return;
    }

    if (panelId === "packages") {
      const sa = packages.self_assessment || [];
      const mtd = packages.mtd || [];
      const saCards = sa.map((p) => `<div class="ts-list-card"><strong>${escapeHtml(p.name)}</strong>
        <div class="ts-price-row">£${Number(p.price_gbp)} · ${escapeHtml(p.billing)}</div>
        <div class="ts-note">${escapeHtml(p.vat_note || "")}. Inclusions are not invented by SIMBA.</div>
        <button type="button" class="ts-follow" data-package="${escapeHtml(p.code)}" style="margin-top:8px">Ask SIMBA about this</button></div>`).join("");
      const mtdCards = mtd.map((p) => `<div class="ts-list-card"><strong>${escapeHtml(p.name)}</strong>
        <div class="ts-price-row">£${Number(p.price_gbp).toFixed(2)} · ${escapeHtml(p.billing)}</div>
        <div class="ts-note">${escapeHtml(p.vat_note || "VAT included")}</div>
        <button type="button" class="ts-follow" data-package="${escapeHtml(p.code)}" style="margin-top:8px">Ask SIMBA about this</button></div>`).join("");
      document.getElementById("ts-panel-packages").innerHTML = `
        <div class="ts-panel-scroll">
          <h2>Our Packages</h2>
          <p class="ts-lead">Accountant-led TaxSimba services. Checkout is completed on TaxSimba systems — SIMBA never confirms payment.</p>
          <div class="ts-section-label">Self Assessment</div>
          ${saCards}
          <div class="ts-section-label">Making Tax Digital (VAT included)</div>
          ${mtdCards}
          <div class="ts-list-card"><a href="${websiteUrl("/self-assessment")}" target="_blank" rel="noopener noreferrer">Self Assessment page</a>
            · <a href="${websiteUrl("/pricing")}" target="_blank" rel="noopener noreferrer">Pricing</a>
            · <a href="${websiteUrl("/making-tax-digital")}" target="_blank" rel="noopener noreferrer">MTD information</a></div>
        </div>`;
      return;
    }

    if (panelId === "consultation") {
      const c = packages.consultation || {};
      document.getElementById("ts-panel-consultation").innerHTML = `
        <div class="ts-panel-scroll">
          <h2>Book a Consultation</h2>
          <p class="ts-lead">Private accountant consultation — not automatic booking inside this chat.</p>
          <div class="ts-list-card">
            <strong>${escapeHtml(c.name || "Private accountant consultation")}</strong>
            <div class="ts-price-row">£${Number(c.price_gbp || 99)} · ${escapeHtml(c.billing || "one-off")}</div>
            <div class="ts-note">${escapeHtml(String(c.duration_minutes || 30))} minutes · ${escapeHtml(c.meeting || "Google Meet")}</div>
            <span class="ts-status-pill">Booking status: ${escapeHtml(c.booking_status || "stub")} — Calendly/Stripe not confirmed live</span>
          </div>
          <div class="ts-list-card">
            <strong>Accountant-led care</strong>
            <div class="ts-note">A TaxSimba accountant leads the session. SIMBA will never claim a consultation is booked or paid until TaxSimba systems confirm it.</div>
            <button type="button" class="ts-follow" data-consult="1" style="margin-top:8px">Ask SIMBA about booking</button>
          </div>
          <div class="ts-list-card"><a href="${websiteUrl("/book-consultation")}" target="_blank" rel="noopener noreferrer">Open consultation page</a>
            <div class="ts-note">Destination is soft/generic until Toxel confirms the live booking flow.</div></div>
        </div>`;
      return;
    }

    if (panelId === "faqs") {
      const chips = FAQ_ITEMS.map(
        (f) => `<button type="button" class="ts-chip" data-starter="${escapeHtml(f.message)}">${escapeHtml(f.q)}</button>`
      ).join("");
      document.getElementById("ts-panel-faqs").innerHTML = `
        <div class="ts-panel-scroll">
          <h2>FAQs</h2>
          <p class="ts-lead">Common questions. Tap one to chat with SIMBA, or open TaxSimba FAQs on the website.</p>
          <div class="ts-chips" style="margin-bottom:14px">${chips}</div>
          <div class="ts-list-card"><a href="${websiteUrl("/faqs")}" target="_blank" rel="noopener noreferrer">TaxSimba FAQs page</a>
            <div class="ts-note">Soft/generic destination until Toxel confirms content.</div></div>
        </div>`;
      return;
    }

    if (panelId === "existing") {
      document.getElementById("ts-panel-existing").innerHTML = `
        <div class="ts-panel-scroll">
          <h2>Existing clients</h2>
          <p class="ts-lead">If you already have a TaxSimba account, contact your assigned accountant through your secure dashboard messaging — not through a new public consultation unless you specifically need one.</p>
          <div class="ts-list-card">
            <strong>Dashboard messaging</strong>
            <div class="ts-note">Authenticated portal access is required. SIMBA does not open other clients’ data.</div>
            <a href="${websiteUrl("/login")}" target="_blank" rel="noopener noreferrer">Client login</a>
            <span class="ts-status-pill">Staging auth E2E BLOCKED</span>
          </div>
          <button type="button" class="ts-follow" data-starter="I am an existing TaxSimba client. How do I contact my assigned accountant?">Ask SIMBA for guidance</button>
        </div>`;
    }
  }

  function appendUser(text) {
    showPanel("chat");
    enterChatView();
    const row = document.createElement("div");
    row.className = "ts-msg user";
    row.innerHTML = `<div class="ts-bubble">${escapeHtml(text)}</div>`;
    els.body.appendChild(row);
    els.body.scrollTop = els.body.scrollHeight;
  }

  function typing() {
    showPanel("chat");
    enterChatView();
    const row = document.createElement("div");
    row.className = "ts-msg assistant";
    row.id = "ts-typing";
    row.innerHTML =
      `<div class="ts-typing" role="status" aria-label="SIMBA is preparing a reply">` +
      `<span class="ts-typing-dot" aria-hidden="true"></span>` +
      `<span>Preparing a reply…</span></div>`;
    els.body.appendChild(row);
    els.body.scrollTop = els.body.scrollHeight;
  }

  function clearTyping() {
    document.getElementById("ts-typing")?.remove();
  }

  function track(event, meta = {}) {
    api("/api/v1/analytics/track", {
      method: "POST",
      body: JSON.stringify({ session_id: state.sessionId, event, meta }),
    }).catch(() => {});
  }

  function renderAssistant(payload) {
    clearTyping();
    showPanel("chat");
    enterChatView();
    const wrap = document.createElement("div");
    wrap.className = "ts-msg assistant";
    let html = `<div class="ts-bubble">${escapeHtml(payload.reply)}</div>`;

    if (payload.journey?.current?.options?.length) {
      html += `<div class="ts-options" role="group" aria-label="Guided options">`;
      for (const opt of payload.journey.current.options) {
        html += `<button type="button" class="ts-option" data-option="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</button>`;
      }
      html += `</div>`;
    }

    const sources = (payload.sources || []).slice(0, 2);
    if (sources.length) {
      html += `<div class="ts-resources" aria-label="Official sources">`;
      for (const s of sources) {
        html += `<div class="ts-source"><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>
          <div class="ts-note">${escapeHtml(s.publisher)}</div></div>`;
      }
      html += `</div>`;
    }

    const calculators = (payload.calculators || []).slice(0, 2).filter((c) => c.url);
    if (calculators.length) {
      html += `<div class="ts-section-label">Useful tools</div><div class="ts-resources">`;
      for (const c of calculators) {
        html += `<div class="ts-card"><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.title)}</a>
          <div class="ts-note">${escapeHtml(c.description || "")}</div></div>`;
      }
      html += `</div>`;
    }

    const routes = (payload.routes || []).slice(0, 1).filter((r) => r.url);
    if (routes.length) {
      html += `<div class="ts-resources">`;
      for (const r of routes) {
        html += `<div class="ts-card"><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label)}</a>
          <div class="ts-note">Continue on TaxSimba</div></div>`;
      }
      html += `</div>`;
    }

    const packages = (payload.packages || []).slice(0, 3);
    if (packages.length) {
      html += `<div class="ts-section-label">Optional TaxSimba support</div><div class="ts-resources">`;
      for (const p of packages) {
        const price = Number(p.price_gbp);
        const priceLabel = Number.isInteger(price) ? `£${price}` : `£${price.toFixed(2)}`;
        html += `<div class="ts-card"><strong>${escapeHtml(p.name)}</strong>
          <div class="price">${priceLabel} · ${escapeHtml(p.billing)}</div>
          <div class="ts-note">${escapeHtml(p.vat_note || "")}</div>
          <button type="button" class="ts-follow" data-package="${escapeHtml(p.code)}" style="margin-top:6px">Tell me more</button></div>`;
      }
      html += `</div>`;
    }

    const followUps = (payload.follow_ups || []).slice(0, 2);
    if (followUps.length) {
      html += `<div class="ts-chips">`;
      for (const f of followUps) {
        html += `<button type="button" class="ts-follow" data-follow="${escapeHtml(f)}">${escapeHtml(f)}</button>`;
      }
      html += `</div>`;
    }

    if (payload.consultation_hint) {
      html += `<div class="ts-hint">${escapeHtml(payload.consultation_hint)}
        <div style="margin-top:6px"><button type="button" class="ts-follow" data-consult="1">Ask about £99 consultation</button></div></div>`;
    }

    wrap.innerHTML = html;
    els.body.appendChild(wrap);
    els.body.scrollTop = els.body.scrollHeight;
    announce("New SIMBA reply");
  }

  function showError(message) {
    clearTyping();
    showPanel("chat");
    enterChatView();
    const err = document.createElement("div");
    err.className = "ts-error";
    err.setAttribute("role", "alert");
    err.innerHTML = `${escapeHtml(message)} <button type="button" class="ts-follow" data-retry="1">Retry</button>`;
    els.body.appendChild(err);
    els.body.scrollTop = els.body.scrollHeight;
  }

  async function sendChat(message, extra = {}) {
    if (!message || state.busy) return;
    if (state.history.length === 0) {
      track("conversation_started", { label: "chat" });
    }
    setBusy(true);
    appendUser(message);
    typing();
    try {
      const payload = {
        session_id: state.sessionId,
        message,
        history: state.history.slice(-12),
        journey_state: state.journey,
        ...extra,
      };
      const data = await api("/api/v1/chat", { method: "POST", body: JSON.stringify(payload) });
      state.history.push({ role: "user", content: message });
      state.history.push({ role: "assistant", content: data.reply });
      state.journey = data.journey || null;
      renderAssistant(data);
    } catch (e) {
      showError(e.message || "Unable to reach SIMBA.");
    } finally {
      setBusy(false);
      els.input.focus();
    }
  }

  async function startJourney(journeyId, userLabel) {
    if (state.busy) return;
    setBusy(true);
    if (userLabel) appendUser(userLabel);
    else {
      showPanel("chat");
      enterChatView();
    }
    typing();
    try {
      const data = await api("/api/v1/journeys/start", {
        method: "POST",
        body: JSON.stringify({ session_id: state.sessionId, journey_id: journeyId }),
      });
      state.journey = data.journey;
      if (userLabel) state.history.push({ role: "user", content: userLabel });
      state.history.push({ role: "assistant", content: data.reply });
      renderAssistant(data);
    } catch (e) {
      showError(e.message || "Could not start guided journey.");
    } finally {
      setBusy(false);
      els.input.focus();
    }
  }

  async function advanceJourney(optionId, label) {
    if (state.busy || !state.journey) return;
    setBusy(true);
    appendUser(label);
    typing();
    try {
      const data = await api("/api/v1/journeys/advance", {
        method: "POST",
        body: JSON.stringify({
          session_id: state.sessionId,
          option_id: optionId,
          journey_state: state.journey,
        }),
      });
      state.history.push({ role: "user", content: label });
      state.history.push({ role: "assistant", content: data.reply });
      state.journey = data.journey || null;
      renderAssistant(data);
    } catch (e) {
      showError(e.message || "Could not continue the journey.");
    } finally {
      setBusy(false);
    }
  }

  function renderWelcome(boot) {
    setView("welcome");
    const mock = boot.mock_notice
      ? `<div class="ts-mock-banner" role="status">${escapeHtml(boot.mock_notice)}</div>`
      : "";
    const topicsHtml = TOPICS.map((t) => {
      const attrs = t.journey
        ? `data-topic-journey="${escapeHtml(t.journey)}" data-topic-label="${escapeHtml(t.title)}"`
        : `data-topic-message="${escapeHtml(t.message || "")}"`;
      return `<button type="button" class="ts-topic" ${attrs}>
        <span class="ts-topic-icon">${ICONS[t.icon] || ""}</span>
        <strong>${escapeHtml(t.title)}</strong>
        <small>${escapeHtml(t.blurb)}</small>
      </button>`;
    }).join("");
    const chips = SUGGESTIONS.map(
      (s) => `<button type="button" class="ts-chip" data-starter="${escapeHtml(s.message)}">${escapeHtml(s.label)}</button>`
    ).join("");

    els.body.innerHTML = `
      ${mock}
      <div class="ts-welcome">
        <h1>Hello — I’m SIMBA, your UK tax assistant</h1>
        <p>Tell me what you need help with. I’ll explain the rules in plain English, then point you to the right TaxSimba tools or services if useful.</p>
        <div class="ts-disclosure">${escapeHtml(
          boot.ai_disclosure ||
            "SIMBA is an AI assistant from TaxSimba — not a qualified human accountant, not HMRC, and not government-approved AI."
        )}</div>
      </div>
      <div class="ts-section-label">How can I help?</div>
      <div class="ts-topics" role="group" aria-label="Tax topics">${topicsHtml}</div>
      <div class="ts-section-label">Suggested questions</div>
      <div class="ts-chips">${chips}</div>
    `;
  }

  function onActionClick(ev) {
    const calcLink = ev.target.closest("a[data-calc-id]");
    if (calcLink) {
      track("calculator_click", { id: calcLink.dataset.calcId, path: calcLink.getAttribute("href") || "" });
    }
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.dataset.panel) {
      showPanel(t.dataset.panel);
      return;
    }
    if (t.dataset.topicJourney) {
      track("topic_click", { journey: t.dataset.topicJourney });
      track("journey_start", { journey: t.dataset.topicJourney });
      startJourney(t.dataset.topicJourney, t.dataset.topicLabel || "");
    } else if (t.dataset.topicMessage) {
      track("topic_click", { label: t.dataset.topicMessage.slice(0, 40) });
      sendChat(t.dataset.topicMessage);
    } else if (t.dataset.starter) {
      showPanel("chat");
      sendChat(t.dataset.starter);
    } else if (t.dataset.option) {
      advanceJourney(t.dataset.option, t.textContent.trim());
    } else if (t.dataset.follow) {
      showPanel("chat");
      sendChat(t.dataset.follow);
    } else if (t.dataset.package) {
      track("package_click", { code: t.dataset.package });
      showPanel("chat");
      sendChat(`Tell me more about the ${t.dataset.package} option without inventing inclusions.`);
    } else if (t.dataset.consult) {
      track("consultation_click", { code: "ACCOUNTANT_CONSULT_99" });
      showPanel("chat");
      sendChat("Can I book a £99 accountant consultation?");
    } else if (t.dataset.retry) {
      const lastUser = [...state.history].reverse().find((m) => m.role === "user");
      if (lastUser) sendChat(lastUser.content);
    }
  }

  document.addEventListener("click", onActionClick);

  els.form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = "";
    sendChat(text);
  });

  els.input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      els.form.requestSubmit();
    }
  });

  els.input.addEventListener("input", () => {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 128) + "px";
  });

  els.del?.addEventListener("click", async () => {
    await api("/api/v1/sessions/delete", {
      method: "POST",
      body: JSON.stringify({ session_id: state.sessionId }),
    }).catch(() => {});
    state.sessionId = crypto.randomUUID();
    state.history = [];
    state.journey = null;
    showPanel("chat");
    if (state.bootstrap) renderWelcome(state.bootstrap);
    announce("Chat deleted");
  });

  els.topicsBtn?.addEventListener("click", () => {
    showPanel("chat");
    if (state.bootstrap) renderWelcome(state.bootstrap);
    announce("Returned to topics");
  });

  els.navToggle?.addEventListener("click", () => {
    const open = !els.shell?.classList.contains("nav-open");
    setNavOpen(open);
  });
  els.backdrop?.addEventListener("click", () => setNavOpen(false));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && els.shell?.classList.contains("nav-open")) {
      setNavOpen(false);
    }
  });

  async function init() {
    try {
      const boot = await api("/api/v1/bootstrap");
      state.bootstrap = boot;
      els.year.textContent = boot.current_tax_year || "—";
      if (boot.llm_mode === "openai") {
        els.mode.textContent = "Live AI";
        els.mode.classList.remove("mock");
      } else {
        els.mode.textContent = "Demo";
        els.mode.classList.add("mock");
      }
      renderWelcome(boot);
    } catch (e) {
      showError(`Could not load SIMBA (${e.message}). Is the API running?`);
    }
  }

  init();
})();
