(() => {
  "use strict";

  const STORAGE_KEY = "salesForecastPoll:v2";
  const DEFAULT_STATE = {
    version: 2,
    settings: {
      game: "影之刃零",
      period: "3 个月",
      limit: 6,
      unit: "万份",
      reveal: "complete"
    },
    votes: []
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const els = {
    gameTitle: $("#game-title"), heroDescription: $("#hero-description"), voteCount: $("#vote-count"), voteLimit: $("#vote-limit"),
    progressTrack: $("#progress-track"), progressFill: $("#progress-fill"), progressCaption: $("#progress-caption"), seats: $("#seats-grid"),
    form: $("#vote-form"), editingId: $("#editing-id"), name: $("#voter-name"), sales: $("#sales-value"), reason: $("#vote-reason"),
    reasonCount: $("#reason-count"), nameError: $("#name-error"), salesError: $("#sales-error"), unitLabel: $("#unit-label"),
    submit: $("#submit-button"), cancelEdit: $("#cancel-edit"), resultsTitle: $("#results-title"), results: $("#results-content"),
    copy: $("#copy-results"), reset: $("#reset-votes"), settingsButton: $("#settings-button"), settingsDialog: $("#settings-dialog"),
    settingsForm: $("#settings-form"), settingGame: $("#setting-game"), settingPeriod: $("#setting-period"), settingLimit: $("#setting-limit"),
    settingUnit: $("#setting-unit"), settingReveal: $("#setting-reveal"), toast: $("#toast")
  };

  let state = loadState();
  let toastTimer;

  function cloneDefault() { return JSON.parse(JSON.stringify(DEFAULT_STATE)); }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.version !== 2 || !parsed.settings || !Array.isArray(parsed.votes)) return cloneDefault();
      return {
        version: 2,
        settings: { ...DEFAULT_STATE.settings, ...parsed.settings, limit: clamp(Number(parsed.settings.limit) || 6, 2, 12) },
        votes: parsed.votes.filter(v => v && v.id && v.name && Number(v.sales) > 0).slice(0, 12)
      };
    } catch {
      return cloneDefault();
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { showToast("保存失败，请检查浏览器存储权限"); }
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function isComplete() { return state.votes.length >= state.settings.limit; }
  function canReveal() { return state.settings.reveal === "live" || isComplete(); }
  function formatNumber(value) { return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 1 }); }
  function seatLabel(index) { return String(index + 1).padStart(2, "0"); }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function render() {
    const { game, period, limit, unit, reveal } = state.settings;
    document.title = `《${game}》销量预测局`;
    els.gameTitle.textContent = game;
    els.heroDescription.textContent = `${limit} 位玩家，一次判断。猜猜正式发售后 ${period}，全球累计销量会到哪里？`;
    $("#seal-limit").textContent = toChineseNumber(limit);
    $("#sales-field-label").textContent = `${period}累计销量`;
    $("#vote-scope").textContent = `统一按全球累计销量计算，以“${unit}”为单位。你可以补一句判断依据，也可以只留下数字。`;
    $("#rule-scope").textContent = `目标为正式发售后 ${period}的全球累计销量，统一使用“${unit}”。`;
    $("#rule-reveal-title").textContent = reveal === "complete" ? "全员揭晓" : "实时战况";
    $("#rule-reveal").textContent = reveal === "complete" ? "全部参与者提交后，自动公开预测榜与平均值、中位数、区间。" : "每次提交后，自动更新预测榜与平均值、中位数、区间。";
    $("#quick-picks").querySelectorAll("button[data-value]").forEach(button => { button.textContent = `${button.dataset.value} ${unit}`; });
    els.voteCount.textContent = state.votes.length;
    els.voteLimit.textContent = limit;
    els.unitLabel.textContent = unit;
    els.progressTrack.setAttribute("aria-valuemax", String(limit));
    els.progressTrack.setAttribute("aria-valuenow", String(state.votes.length));
    els.progressFill.style.width = `${(state.votes.length / limit) * 100}%`;
    els.progressCaption.textContent = isComplete() ? `${toChineseNumber(limit)}人预测已集齐，结果已经揭晓` : state.votes.length ? `还差 ${limit - state.votes.length} 人，静候落子` : "等待第一位玩家落子";
    $("#seats-title").textContent = `${toChineseNumber(limit)}席，静候高见`;
    $(".rule-chip p").innerHTML = reveal === "complete" ? "<strong>公平揭晓</strong>全部席位提交后，预测榜与统计数据才会公开。" : "<strong>实时战况</strong>每次提交后，预测榜与统计数据会立即更新。";
    renderSeats();
    renderResults();
    updateFormAvailability();
  }

  function toChineseNumber(number) {
    const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
    return map[number] || String(number);
  }

  function renderSeats() {
    els.seats.replaceChildren();
    for (let index = 0; index < state.settings.limit; index += 1) {
      const vote = state.votes[index];
      const card = document.createElement("article");
      card.className = `seat-card${vote ? " filled" : ""}`;
      card.dataset.seat = seatLabel(index);

      const top = document.createElement("div");
      top.className = "seat-top";
      const number = document.createElement("span");
      number.className = "seat-number";
      number.textContent = `SEAT ${seatLabel(index)}`;
      const status = document.createElement("span");
      status.className = "seat-status";
      status.innerHTML = `<i aria-hidden="true"></i>${vote ? "已封票" : "等待中"}`;
      top.append(number, status);

      const title = document.createElement("h3");
      title.textContent = vote ? vote.name : "虚位以待";
      const detail = document.createElement("p");
      detail.textContent = vote ? (canReveal() ? `${formatNumber(vote.sales)} ${state.settings.unit}` : "预测数字暂不公开") : "等待一位玩家落子";
      card.append(top, title, detail);

      if (vote) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "seat-edit";
        edit.dataset.editId = vote.id;
        edit.textContent = "修改";
        edit.setAttribute("aria-label", `修改 ${vote.name} 的预测`);
        card.append(edit);
      }
      els.seats.append(card);
    }
  }

  function renderResults() {
    els.results.replaceChildren();
    const visible = canReveal() && state.votes.length > 0;
    els.copy.disabled = !visible;

    if (!state.votes.length) {
      els.resultsTitle.textContent = "答案，暂藏锋芒";
      els.results.append(createLockedState("还没有人落子", "提交第一份预测，开启这场销量竞猜。", false));
      return;
    }
    if (!canReveal()) {
      const remaining = state.settings.limit - state.votes.length;
      els.resultsTitle.textContent = "答案，暂藏锋芒";
      els.results.append(createLockedState("预测已经封存", `还差 ${remaining} 人，所有数字将在全员提交后同时揭晓。`, true));
      return;
    }

    els.resultsTitle.textContent = isComplete() ? `${toChineseNumber(state.settings.limit)}人落定，锋芒尽显` : "实时战况，一目了然";
    const values = state.votes.map(v => Number(v.sales)).sort((a, b) => a - b);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const avg = sum / values.length;
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    const max = values[values.length - 1];
    const min = values[0];
    const stats = [
      ["平均预测", avg], ["中位预测", median], ["最高预测", max], ["最低预测", min], ["预测跨度", max - min]
    ];
    const statsGrid = document.createElement("div");
    statsGrid.className = "stats-grid";
    stats.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = formatNumber(value);
      const unit = document.createElement("small");
      unit.textContent = state.settings.unit;
      card.append(labelNode, strong, unit);
      statsGrid.append(card);
    });

    const ranking = document.createElement("div");
    ranking.className = "ranking-list";
    [...state.votes].sort((a, b) => b.sales - a.sales).forEach((vote, index) => {
      const row = document.createElement("article");
      row.className = `ranking-row${Number(vote.sales) === max ? " winner" : ""}`;
      row.style.setProperty("--bar-width", `${Math.max(8, (Number(vote.sales) / max) * 100)}%`);
      const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span"); name.className = "ranking-name"; name.textContent = vote.name;
      const reason = document.createElement("span"); reason.className = "ranking-bar"; reason.textContent = vote.reason || "未留下判断依据";
      const value = document.createElement("strong"); value.className = "ranking-value"; value.textContent = formatNumber(vote.sales);
      const unit = document.createElement("small"); unit.textContent = ` ${state.settings.unit}`; value.append(unit);
      row.append(rank, name, reason, value); ranking.append(row);
    });

    const consensus = document.createElement("p");
    consensus.className = "consensus";
    consensus.innerHTML = `本局共识：<strong>${state.votes.length} 位玩家的平均预测为 ${formatNumber(avg)} ${escapeHtml(state.settings.unit)}</strong>，最谨慎与最乐观的判断相差 ${formatNumber(max - min)} ${escapeHtml(state.settings.unit)}。`;
    els.results.append(statsGrid, ranking, consensus);
  }

  function createLockedState(title, description, locked) {
    const wrap = document.createElement("div");
    wrap.className = locked ? "results-locked" : "results-empty";
    const inner = document.createElement("div");
    const symbol = document.createElement("div"); symbol.className = "lock-symbol";
    symbol.innerHTML = locked ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V6Zm3 9.7V18h-2v-2.3a2 2 0 1 1 2 0Z"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.5 6.8L22 12l-7.5 3.2L12 22l-2.5-6.8L2 12l7.5-3.2L12 2Z"/></svg>';
    const heading = document.createElement("h3"); heading.textContent = title;
    const paragraph = document.createElement("p"); paragraph.textContent = description;
    inner.append(symbol, heading, paragraph); wrap.append(inner); return wrap;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function updateFormAvailability() {
    const editing = Boolean(els.editingId.value);
    const full = isComplete() && !editing;
    [els.name, els.sales, els.reason, ...$("#quick-picks").querySelectorAll("button")].forEach(control => control.disabled = full);
    els.submit.disabled = full;
    els.submit.style.opacity = full ? ".45" : "1";
    els.submit.style.cursor = full ? "not-allowed" : "pointer";
    if (full) els.submit.firstChild.textContent = "本轮席位已满 ";
  }

  function clearErrors() { els.nameError.textContent = ""; els.salesError.textContent = ""; }

  function validateVote() {
    clearErrors();
    const name = els.name.value.trim();
    const sales = Number(els.sales.value);
    let valid = true;
    if (!name) { els.nameError.textContent = "请先留下你的名字"; valid = false; }
    const duplicate = state.votes.some(v => v.name.toLocaleLowerCase() === name.toLocaleLowerCase() && v.id !== els.editingId.value);
    if (duplicate) { els.nameError.textContent = "这个名字已经投过票，请直接修改原票"; valid = false; }
    if (!Number.isFinite(sales) || sales <= 0 || sales > 9999) { els.salesError.textContent = "请输入 0.1–9999 之间的有效数字"; valid = false; }
    return valid;
  }

  function resetForm() {
    els.form.reset(); els.editingId.value = ""; els.reasonCount.textContent = "0"; clearErrors();
    els.submit.innerHTML = '锁定我的预测 <span aria-hidden="true">→</span>';
    els.cancelEdit.classList.add("hidden");
    $("#quick-picks").querySelectorAll("button").forEach(button => button.classList.remove("active"));
    updateFormAvailability();
  }

  els.form.addEventListener("submit", event => {
    event.preventDefault();
    if (isComplete() && !els.editingId.value) { showToast(`${state.settings.limit} 个席位已满，本轮投票已经结束`); return; }
    if (!validateVote()) return;
    const payload = {
      id: els.editingId.value || (crypto.randomUUID ? crypto.randomUUID() : `vote-${Date.now()}-${Math.random()}`),
      name: els.name.value.trim(), sales: Math.round(Number(els.sales.value) * 10) / 10,
      reason: els.reason.value.trim(), updatedAt: new Date().toISOString()
    };
    const existingIndex = state.votes.findIndex(v => v.id === payload.id);
    if (existingIndex >= 0) state.votes[existingIndex] = payload;
    else state.votes.push(payload);
    saveState(); resetForm(); render();
    showToast(existingIndex >= 0 ? "预测已经更新" : (isComplete() ? `${toChineseNumber(state.settings.limit)}人预测已集齐，结果揭晓` : "预测已记录，等其他人落子"));
    if (isComplete()) $(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.seats.addEventListener("click", event => {
    const button = event.target.closest("[data-edit-id]");
    if (!button) return;
    const vote = state.votes.find(v => v.id === button.dataset.editId);
    if (!vote) return;
    els.editingId.value = vote.id; els.name.value = vote.name; els.sales.value = vote.sales; els.reason.value = vote.reason || "";
    els.reasonCount.textContent = String((vote.reason || "").length);
    els.submit.innerHTML = '更新预测 <span aria-hidden="true">→</span>';
    els.cancelEdit.classList.remove("hidden"); updateFormAvailability();
    $("#vote-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => els.name.focus(), 450);
  });

  els.cancelEdit.addEventListener("click", resetForm);
  els.reason.addEventListener("input", () => { els.reasonCount.textContent = String(els.reason.value.length); });
  $("#quick-picks").addEventListener("click", event => {
    const button = event.target.closest("button[data-value]");
    if (!button || button.disabled) return;
    els.sales.value = button.dataset.value;
    $("#quick-picks").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    els.salesError.textContent = "";
  });

  els.reset.addEventListener("click", () => {
    if (!state.votes.length) { showToast("当前还没有投票记录"); return; }
    if (!window.confirm("确定清空本轮的全部预测吗？清空后无法恢复。")) return;
    state.votes = []; saveState(); resetForm(); render(); showToast("本轮预测已清空");
  });

  els.copy.addEventListener("click", async () => {
    const values = state.votes.map(v => Number(v.sales));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const lines = [
      `《${state.settings.game}》${state.settings.period}销量预测`,
      ...[...state.votes].sort((a, b) => b.sales - a.sales).map((v, i) => `${i + 1}. ${v.name}：${formatNumber(v.sales)} ${state.settings.unit}${v.reason ? `（${v.reason}）` : ""}`),
      `平均预测：${formatNumber(avg)} ${state.settings.unit}`,
      "销量预测仅供娱乐，不代表官方数据。"
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); showToast("结果摘要已复制"); }
    catch { showToast("复制失败，请检查浏览器权限"); }
  });

  els.settingsButton.addEventListener("click", () => {
    els.settingGame.value = state.settings.game; els.settingPeriod.value = state.settings.period;
    els.settingLimit.value = state.settings.limit; els.settingUnit.value = state.settings.unit; els.settingReveal.value = state.settings.reveal;
    els.settingsDialog.showModal();
  });

  els.settingsForm.addEventListener("submit", event => {
    const submitter = event.submitter;
    if (!submitter || submitter.value === "cancel") return;
    event.preventDefault();
    const next = {
      game: els.settingGame.value.trim(), period: els.settingPeriod.value.trim(),
      limit: clamp(Math.round(Number(els.settingLimit.value)), 2, 12), unit: els.settingUnit.value.trim(), reveal: els.settingReveal.value
    };
    if (!next.game || !next.period || !next.unit) { showToast("请完整填写预测局设置"); return; }
    if (next.limit < state.votes.length) { showToast(`参与人数不能少于当前已投票人数 ${state.votes.length}`); return; }
    const scopeChanged = next.game !== state.settings.game || next.period !== state.settings.period || next.unit !== state.settings.unit;
    if (scopeChanged && state.votes.length && !window.confirm("修改游戏名称、周期或单位将清空现有预测。继续吗？")) return;
    if (scopeChanged) state.votes = [];
    state.settings = next; saveState(); resetForm(); render(); els.settingsDialog.close(); showToast("预测局设置已更新");
  });

  els.settingsDialog.addEventListener("click", event => {
    if (event.target !== els.settingsDialog) return;
    const rect = els.settingsDialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) els.settingsDialog.close();
  });

  $("#footer-year").textContent = String(new Date().getFullYear());
  render();
})();
