(() => {
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const API_BASE = (params.get("api") || root.dataset.apiBase || "").replace(/\/$/, "");
  const state = {
    sessionId: crypto.randomUUID(),
    history: [],
    journey: null,
    bootstrap: null,
    busy: false,
  };

  const els = {
    body: document.getElementById("ts-body"),
    year: document.getElementById("ts-year"),
    mode: document.getElementById("ts-mode"),
    form: document.getElementById("ts-form"),
    input: document.getElementById("ts-input"),
    send: document.getElementById("ts-send"),
    live: document.getElementById("ts-live"),
    del: document.getElementById("ts-delete"),
  };

  function api(path, options) {
    return fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      ...options,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || data?.detail?.[0]?.msg || data?.detail || `Request failed (${res.status})`;
        throw new Error(typeof msg === "string" ? msg : "Something went wrong");
      }
      return data;
    });
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

  function appendUser(text) {
    const row = document.createElement("div");
    row.className = "ts-msg user";
    row.innerHTML = `<div class="ts-bubble">${escapeHtml(text)}</div>`;
    els.body.appendChild(row);
    els.body.scrollTop = els.body.scrollHeight;
  }

  function typing() {
    const row = document.createElement("div");
    row.className = "ts-msg assistant";
    row.id = "ts-typing";
    row.innerHTML = `<div class="ts-typing" aria-label="SIMBA is preparing a reply"><i></i><i></i><i></i></div>`;
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

    if (payload.sources?.length) {
      html += `<div class="ts-sources" aria-label="Sources">`;
      for (const s of payload.sources) {
        html += `<div class="ts-source"><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>
          <div class="ts-note">${escapeHtml(s.publisher)} · ${escapeHtml((s.tax_years || []).join(", "))}</div></div>`;
      }
      html += `</div>`;
    }

    if (payload.packages?.length) {
      html += `<div class="ts-section-label">Optional support (no pressure)</div><div class="ts-cards">`;
      for (const p of payload.packages) {
        const price = Number(p.price_gbp);
        const priceLabel = Number.isInteger(price) ? `£${price}` : `£${price.toFixed(2)}`;
        html += `<div class="ts-card"><strong>${escapeHtml(p.name)}</strong>
          <div class="price">${priceLabel} · ${escapeHtml(p.billing)}</div>
          <div class="ts-note">${escapeHtml(p.vat_note || "")}. Inclusions not invented by SIMBA.</div>
          <button type="button" class="ts-follow" data-package="${escapeHtml(p.code)}" style="margin-top:6px">View option</button></div>`;
      }
      html += `</div>`;
    }

    if (payload.calculators?.length) {
      html += `<div class="ts-section-label">Calculator suggestions</div><div class="ts-cards">`;
      for (const c of payload.calculators) {
        html += `<div class="ts-card"><strong>${escapeHtml(c.title)}</strong><div>${escapeHtml(c.description)}</div>
          <div class="ts-note">${escapeHtml(c.note || c.url_status || "")}</div></div>`;
      }
      html += `</div>`;
    }

    if (payload.routes?.length) {
      html += `<div class="ts-section-label">Related TaxSimba pages (configured stubs)</div><div class="ts-cards">`;
      for (const r of payload.routes) {
        html += `<div class="ts-card"><strong>${escapeHtml(r.label)}</strong>
          <div class="ts-note">${escapeHtml(r.path)} · ${escapeHtml(r.note || r.status)}</div></div>`;
      }
      html += `</div>`;
    }

    if (payload.follow_ups?.length) {
      html += `<div class="ts-section-label">Suggested follow-ups</div><div class="ts-chips">`;
      for (const f of payload.follow_ups) {
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
    const err = document.createElement("div");
    err.className = "ts-error";
    err.setAttribute("role", "alert");
    err.innerHTML = `${escapeHtml(message)} <button type="button" class="ts-follow" data-retry="1">Retry</button>`;
    els.body.appendChild(err);
    els.body.scrollTop = els.body.scrollHeight;
  }

  async function sendChat(message, extra = {}) {
    if (!message || state.busy) return;
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

  async function startJourney(journeyId) {
    if (state.busy) return;
    setBusy(true);
    typing();
    try {
      const data = await api("/api/v1/journeys/start", {
        method: "POST",
        body: JSON.stringify({ session_id: state.sessionId, journey_id: journeyId }),
      });
      state.journey = data.journey;
      state.history.push({ role: "assistant", content: data.reply });
      renderAssistant(data);
    } catch (e) {
      showError(e.message || "Could not start guided journey.");
    } finally {
      setBusy(false);
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
    const starters = (boot.starters || []).slice(0, 6);
    const journeys = boot.journeys || [];
    const mock = boot.mock_notice
      ? `<div class="ts-mock-banner" role="status">${escapeHtml(boot.mock_notice)}</div>`
      : "";
    els.body.innerHTML = `
      ${mock}
      <div class="ts-welcome">
        <h1>${escapeHtml(boot.welcome_message || "Hello, I’m Simba.")}</h1>
        <p>Clear, source-backed guidance for Self Assessment, MTD and more.</p>
        <div class="ts-disclosure">${escapeHtml(boot.ai_disclosure || "")}</div>
      </div>
      <div class="ts-section-label">Starter questions</div>
      <div class="ts-chips">
        ${starters.map((s) => `<button type="button" class="ts-chip" data-starter="${escapeHtml(s.message)}" data-journey="${escapeHtml(s.journey || "")}">${escapeHtml(s.label)}</button>`).join("")}
      </div>
      <div class="ts-section-label">Guided journeys</div>
      <div class="ts-chips" style="display:grid;gap:8px">
        ${journeys.map((j) => `<button type="button" class="ts-journey" data-journey-start="${escapeHtml(j.id)}"><strong>${escapeHtml(j.title)}</strong><small>${escapeHtml(j.description)}</small></button>`).join("")}
      </div>
    `;
  }

  els.body.addEventListener("click", (ev) => {
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.dataset.starter) {
      if (t.dataset.journey) startJourney(t.dataset.journey);
      else sendChat(t.dataset.starter);
    } else if (t.dataset.journeyStart) {
      startJourney(t.dataset.journeyStart);
    } else if (t.dataset.option) {
      advanceJourney(t.dataset.option, t.textContent.trim());
    } else if (t.dataset.follow) {
      sendChat(t.dataset.follow);
    } else if (t.dataset.package) {
      track("package_click", { code: t.dataset.package });
      sendChat(`Tell me more about the ${t.dataset.package} option without inventing inclusions.`);
    } else if (t.dataset.consult) {
      track("consultation_click", { code: "ACCOUNTANT_CONSULT_99" });
      sendChat("Can I book a £99 accountant consultation?");
    } else if (t.dataset.retry) {
      const lastUser = [...state.history].reverse().find((m) => m.role === "user");
      if (lastUser) sendChat(lastUser.content);
    }
  });

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

  els.del?.addEventListener("click", async () => {
    await api("/api/v1/sessions/delete", {
      method: "POST",
      body: JSON.stringify({ session_id: state.sessionId }),
    }).catch(() => {});
    state.sessionId = crypto.randomUUID();
    state.history = [];
    state.journey = null;
    if (state.bootstrap) renderWelcome(state.bootstrap);
    announce("Chat deleted");
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
        els.mode.textContent = "Demo / mock";
        els.mode.classList.add("mock");
      }
      renderWelcome(boot);
    } catch (e) {
      showError(`Could not load SIMBA (${e.message}). Is the API running?`);
    }
  }

  init();
})();
