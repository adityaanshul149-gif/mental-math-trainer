import {
  createCard,
  createCategory,
  deleteCard,
  deleteCategory,
  duplicateCard,
  importCards,
  loadData,
  parseCardText,
  recordCardAttempt,
  saveSessionResult,
  toggleCardFlag,
  updateCard,
  updateCategory
} from "./data-store.js";

const APP_VERSION = "0.3.0";
const THEME_KEY = "recall.theme";
const VALID_ROUTES = new Set(["home", "practice", "library", "import", "settings"]);
const VALID_THEMES = new Set(["system", "light", "dark"]);

let state = loadData();
let activeCardFilter = "all";
let previewPairs = [];
let editorState = null;
let toastTimer = null;
let activeSession = null;
let lastSessionConfig = null;
let longPressTimer = null;
let gestureStart = null;
let backspaceLongPressed = false;

const elements = {
  views: [...document.querySelectorAll("[data-view]")],
  routeLinks: [...document.querySelectorAll("[data-route]")],
  themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
  connectionStatus: document.querySelector("#connection-status"),
  connectionLabel: document.querySelector("#connection-label"),
  categoryCount: document.querySelector("#category-count"),
  cardCount: document.querySelector("#card-count"),
  favouriteCount: document.querySelector("#favourite-count"),
  sessionBuilder: document.querySelector("#session-builder"),
  sessionForm: document.querySelector("#session-form"),
  sessionCategoryGrid: document.querySelector("#session-category-grid"),
  sessionError: document.querySelector("#session-error"),
  questionStage: document.querySelector("#question-stage"),
  sessionResults: document.querySelector("#session-results"),
  questionProgressLabel: document.querySelector("#question-progress-label"),
  questionProgressBar: document.querySelector("#question-progress-bar"),
  timerPill: document.querySelector("#timer-pill"),
  questionCategory: document.querySelector("#question-category"),
  questionText: document.querySelector("#question-text"),
  questionSurface: document.querySelector("#question-surface"),
  typedAnswer: document.querySelector("#typed-answer"),
  answerFeedback: document.querySelector("#answer-feedback"),
  keypad: document.querySelector("#numeric-keypad"),
  revealActions: document.querySelector("#reveal-actions"),
  resultsSummary: document.querySelector("#results-summary"),
  resultMetrics: document.querySelector("#result-metrics"),
  resultBreakdown: document.querySelector("#result-breakdown"),
  librarySummary: document.querySelector("#library-summary"),
  search: document.querySelector("#card-search"),
  categoryFilter: document.querySelector("#category-filter"),
  filterButtons: [...document.querySelectorAll("[data-card-filter]")],
  categoryStrip: document.querySelector("#category-strip"),
  cardList: document.querySelector("#card-list"),
  importCategory: document.querySelector("#import-category"),
  importText: document.querySelector("#import-text"),
  importPreview: document.querySelector("#import-preview"),
  previewList: document.querySelector("#preview-list"),
  previewCount: document.querySelector("#preview-count"),
  editorDialog: document.querySelector("#editor-dialog"),
  editorForm: document.querySelector("#editor-form"),
  editorFields: document.querySelector("#editor-fields"),
  dialogEyebrow: document.querySelector("#dialog-eyebrow"),
  dialogTitle: document.querySelector("#dialog-title"),
  saveEditorButton: document.querySelector("#save-editor-button"),
  editorError: document.querySelector("#editor-error"),
  toast: document.querySelector("#toast")
};

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return VALID_THEMES.has(storedTheme) ? storedTheme : "system";
}

function resolveTheme(theme) {
  return theme === "system" ? (systemTheme.matches ? "dark" : "light") : theme;
}

function applyTheme(theme) {
  const safeTheme = VALID_THEMES.has(theme) ? theme : "system";
  document.documentElement.dataset.theme = safeTheme;
  document.documentElement.dataset.resolvedTheme = resolveTheme(safeTheme);
  elements.themeButtons.forEach((button) => {
    const isSelected = button.dataset.themeChoice === safeTheme;
    button.setAttribute("aria-checked", String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
  });
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function getRoute() {
  const requestedRoute = window.location.hash.slice(1).toLowerCase();
  return VALID_ROUTES.has(requestedRoute) ? requestedRoute : "home";
}

function renderRoute() {
  const route = getRoute();
  elements.views.forEach((view) => {
    view.hidden = view.dataset.view !== route;
  });
  elements.routeLinks.forEach((link) => {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `${route[0].toUpperCase()}${route.slice(1)} — Recall`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderConnectionStatus() {
  const isOnline = navigator.onLine;
  elements.connectionStatus.classList.toggle("is-offline", !isOnline);
  elements.connectionLabel.textContent = isOnline ? "Online" : "Offline ready";
}

function renderCounts() {
  elements.categoryCount.textContent = state.categories.length.toLocaleString();
  elements.cardCount.textContent = state.cards.length.toLocaleString();
  elements.favouriteCount.textContent = state.cards.filter((card) => card.favourite).length.toLocaleString();
}

function categoryOptions(selectedId, includeAll = false) {
  const options = includeAll ? '<option value="all">All categories</option>' : "";
  return options + state.categories
    .map((category) => {
      const selected = category.id === selectedId ? " selected" : "";
      return `<option value="${escapeHTML(category.id)}"${selected}>${escapeHTML(category.name)}</option>`;
    })
    .join("");
}

function renderCategoryControls() {
  const previousFilter = elements.categoryFilter.value || "all";
  const previousImportCategory = elements.importCategory.value;
  elements.categoryFilter.innerHTML = categoryOptions(previousFilter, true);
  if (previousFilter !== "all" && !state.categories.some((category) => category.id === previousFilter)) {
    elements.categoryFilter.value = "all";
  }
  elements.importCategory.innerHTML = categoryOptions(previousImportCategory);
  if (state.categories.some((category) => category.id === previousImportCategory)) {
    elements.importCategory.value = previousImportCategory;
  }

  elements.categoryStrip.innerHTML = state.categories.map((category) => {
    const cardCount = state.cards.filter((card) => card.categoryId === category.id).length;
    return `
      <article class="category-chip">
        <button class="category-select-button" type="button" data-select-category="${escapeHTML(category.id)}">
          <strong>${escapeHTML(category.name)}</strong>
          <span>${cardCount.toLocaleString()} ${cardCount === 1 ? "card" : "cards"}</span>
        </button>
        <button class="mini-button" type="button" data-edit-category="${escapeHTML(category.id)}" aria-label="Edit ${escapeHTML(category.name)}">Edit</button>
        <button class="mini-button danger-text" type="button" data-delete-category="${escapeHTML(category.id)}" aria-label="Delete ${escapeHTML(category.name)}">Delete</button>
      </article>
    `;
  }).join("");

  elements.sessionCategoryGrid.innerHTML = state.categories.map((category) => {
    const cardCount = state.cards.filter((card) => card.categoryId === category.id).length;
    const disabled = cardCount === 0 ? " disabled" : "";
    const checked = cardCount > 0 ? " checked" : "";
    return `
      <label class="${cardCount ? "" : "is-disabled"}">
        <input type="checkbox" name="sessionCategory" value="${escapeHTML(category.id)}"${checked}${disabled}>
        <span><strong>${escapeHTML(category.name)}</strong><small>${cardCount.toLocaleString()} ${cardCount === 1 ? "card" : "cards"}</small></span>
      </label>
    `;
  }).join("");
}

function filteredCards() {
  const query = elements.search.value.trim().toLowerCase();
  const categoryId = elements.categoryFilter.value || "all";
  return state.cards.filter((card) => {
    if (categoryId !== "all" && card.categoryId !== categoryId) return false;
    if (activeCardFilter === "favourite" && !card.favourite) return false;
    if (activeCardFilter === "practice" && !card.practice) return false;
    if (query && !`${card.prompt} ${card.answer}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

function renderCards() {
  const cards = filteredCards();
  elements.librarySummary.textContent = `Showing ${cards.length.toLocaleString()} of ${state.cards.length.toLocaleString()} cards.`;
  if (!cards.length) {
    elements.cardList.innerHTML = `
      <div class="empty-state">
        <span aria-hidden="true">⌕</span>
        <h2>No matching cards</h2>
        <p>Change the filters or create a new card.</p>
        <button class="primary-button" type="button" data-empty-add-card>New card</button>
      </div>
    `;
    return;
  }

  const categoryMap = new Map(state.categories.map((category) => [category.id, category.name]));
  elements.cardList.innerHTML = cards.map((card) => `
    <article class="library-card">
      <div class="card-content">
        <span class="category-label">${escapeHTML(categoryMap.get(card.categoryId) ?? "Unknown")}</span>
        <h2>${escapeHTML(card.prompt)}</h2>
        <p>${escapeHTML(card.answer)}</p>
      </div>
      <div class="card-actions">
        <button type="button" data-toggle-favourite="${escapeHTML(card.id)}" aria-pressed="${card.favourite}">
          ${card.favourite ? "★ Favourite" : "☆ Favourite"}
        </button>
        <button type="button" data-toggle-practice="${escapeHTML(card.id)}" aria-pressed="${card.practice}">
          ${card.practice ? "✓ Practice" : "＋ Practice"}
        </button>
        <button type="button" data-edit-card="${escapeHTML(card.id)}">Edit</button>
        <button type="button" data-duplicate-card="${escapeHTML(card.id)}">Duplicate</button>
        <button class="danger-text" type="button" data-delete-card="${escapeHTML(card.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderAll() {
  renderCounts();
  renderCategoryControls();
  renderCards();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function openCategoryEditor(category = null) {
  editorState = { type: "category", id: category?.id ?? null };
  elements.dialogEyebrow.textContent = "Category editor";
  elements.dialogTitle.textContent = category ? "Edit category" : "New category";
  elements.saveEditorButton.textContent = category ? "Save changes" : "Create category";
  elements.editorFields.innerHTML = `
    <label class="field-label" for="category-name-input">Category name</label>
    <input id="category-name-input" name="name" type="text" maxlength="80" value="${escapeHTML(category?.name ?? "")}" placeholder="Example: Vocabulary" required>
  `;
  openEditorDialog();
}

function openCardEditor(card = null, preferredCategoryId = null) {
  if (!state.categories.length) {
    showToast("Create a category before adding a card.");
    openCategoryEditor();
    return;
  }
  const selectedCategoryId = card?.categoryId ?? preferredCategoryId ?? state.categories[0].id;
  editorState = { type: "card", id: card?.id ?? null };
  elements.dialogEyebrow.textContent = "Card editor";
  elements.dialogTitle.textContent = card ? "Edit card" : "New card";
  elements.saveEditorButton.textContent = card ? "Save changes" : "Create card";
  elements.editorFields.innerHTML = `
    <label class="field-label" for="card-category-input">Category</label>
    <select id="card-category-input" name="categoryId" required>${categoryOptions(selectedCategoryId)}</select>
    <label class="field-label" for="card-prompt-input">Question or prompt</label>
    <textarea id="card-prompt-input" name="prompt" rows="3" maxlength="500" placeholder="Example: 17 × 19" required>${escapeHTML(card?.prompt ?? "")}</textarea>
    <label class="field-label" for="card-answer-input">Answer</label>
    <textarea id="card-answer-input" name="answer" rows="3" maxlength="500" placeholder="Example: 323" required>${escapeHTML(card?.answer ?? "")}</textarea>
  `;
  openEditorDialog();
}

function openEditorDialog() {
  elements.editorError.hidden = true;
  elements.editorError.textContent = "";
  elements.editorDialog.showModal();
  elements.editorFields.querySelector("input, select, textarea")?.focus();
}

function closeEditorDialog() {
  elements.editorDialog.close();
  editorState = null;
}

function submitEditor(event) {
  event.preventDefault();
  const formData = new FormData(elements.editorForm);
  try {
    if (editorState.type === "category") {
      const name = String(formData.get("name") ?? "");
      state = editorState.id
        ? updateCategory(state, editorState.id, name)
        : createCategory(state, name);
      showToast(editorState.id ? "Category updated." : "Category created.");
    } else {
      const values = {
        categoryId: String(formData.get("categoryId") ?? ""),
        prompt: String(formData.get("prompt") ?? ""),
        answer: String(formData.get("answer") ?? "")
      };
      state = editorState.id
        ? updateCard(state, editorState.id, values)
        : createCard(state, values);
      showToast(editorState.id ? "Card updated." : "Card created.");
    }
    closeEditorDialog();
    renderAll();
  } catch (error) {
    elements.editorError.textContent = error.message;
    elements.editorError.hidden = false;
  }
}

function handleCategoryAction(event) {
  const selectButton = event.target.closest("[data-select-category]");
  if (selectButton) {
    elements.categoryFilter.value = selectButton.dataset.selectCategory;
    renderCards();
    return;
  }

  const editButton = event.target.closest("[data-edit-category]");
  if (editButton) {
    const category = state.categories.find((item) => item.id === editButton.dataset.editCategory);
    if (category) openCategoryEditor(category);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-category]");
  if (!deleteButton) return;
  if (state.categories.length === 1) {
    showToast("Keep at least one category.");
    return;
  }
  const category = state.categories.find((item) => item.id === deleteButton.dataset.deleteCategory);
  if (!category) return;
  const cardCount = state.cards.filter((card) => card.categoryId === category.id).length;
  const message = cardCount
    ? `Delete “${category.name}” and its ${cardCount} cards? This cannot be undone.`
    : `Delete “${category.name}”? This cannot be undone.`;
  if (!window.confirm(message)) return;
  state = deleteCategory(state, category.id);
  renderAll();
  showToast("Category deleted.");
}

function handleCardAction(event) {
  if (event.target.closest("[data-empty-add-card]")) {
    openCardEditor();
    return;
  }
  const actionButton = event.target.closest("button");
  if (!actionButton) return;
  const action = Object.keys(actionButton.dataset)[0];
  const id = actionButton.dataset[action];
  if (!id) return;

  if (action === "toggleFavourite") {
    state = toggleCardFlag(state, id, "favourite");
    renderAll();
  } else if (action === "togglePractice") {
    state = toggleCardFlag(state, id, "practice");
    renderAll();
  } else if (action === "editCard") {
    const card = state.cards.find((item) => item.id === id);
    if (card) openCardEditor(card);
  } else if (action === "duplicateCard") {
    state = duplicateCard(state, id);
    renderAll();
    showToast("Card duplicated.");
  } else if (action === "deleteCard") {
    const card = state.cards.find((item) => item.id === id);
    if (!card || !window.confirm(`Delete “${card.prompt}”? This cannot be undone.`)) return;
    state = deleteCard(state, id);
    renderAll();
    showToast("Card deleted.");
  }
}

function previewImport() {
  const result = parseCardText(elements.importText.value);
  previewPairs = result.pairs;
  if (result.errors.length) {
    elements.importPreview.hidden = true;
    showToast(result.errors[0]);
    return;
  }
  if (!previewPairs.length) {
    elements.importPreview.hidden = true;
    showToast("Paste at least one complete question = answer line.");
    return;
  }
  elements.previewCount.textContent = `${previewPairs.length} ${previewPairs.length === 1 ? "card" : "cards"}`;
  elements.previewList.innerHTML = previewPairs.map((pair) => `
    <div class="preview-row"><strong>${escapeHTML(pair.prompt)}</strong><span aria-hidden="true">→</span><span>${escapeHTML(pair.answer)}</span></div>
  `).join("");
  elements.importPreview.hidden = false;
  elements.importPreview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function confirmImport() {
  if (!previewPairs.length) return;
  try {
    state = importCards(state, elements.importCategory.value, previewPairs);
    const count = previewPairs.length;
    previewPairs = [];
    elements.importText.value = "";
    elements.importPreview.hidden = true;
    renderAll();
    showToast(`${count} ${count === 1 ? "card" : "cards"} imported.`);
    window.location.hash = "library";
  } catch (error) {
    showToast(error.message);
  }
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function masteryOf(card) {
  return Number(card.stats?.mastery ?? 0);
}

function arrangeCards(cards, mode) {
  if (mode === "weak") {
    return [...cards].sort((a, b) => masteryOf(a) - masteryOf(b) || Math.random() - 0.5);
  }
  if (mode === "strong") {
    return [...cards].sort((a, b) => masteryOf(b) - masteryOf(a) || Math.random() - 0.5);
  }
  if (mode === "adaptive") {
    const pool = [...cards];
    const arranged = [];
    while (pool.length) {
      const weights = pool.map((card) => Number(card.stats?.adaptivePriority ?? 1));
      const totalWeight = weights.reduce((total, weight) => total + weight, 0);
      let target = Math.random() * totalWeight;
      let selectedIndex = 0;
      for (let index = 0; index < weights.length; index += 1) {
        target -= weights[index];
        if (target <= 0) {
          selectedIndex = index;
          break;
        }
      }
      arranged.push(pool.splice(selectedIndex, 1)[0]);
    }
    return arranged;
  }
  if (mode === "mixed") {
    const sorted = [...cards].sort((a, b) => masteryOf(a) - masteryOf(b));
    const arranged = [];
    let low = 0;
    let high = sorted.length - 1;
    while (low <= high) {
      arranged.push(sorted[low]);
      low += 1;
      if (low <= high) {
        arranged.push(sorted[high]);
        high -= 1;
      }
    }
    return arranged;
  }
  return shuffle(cards);
}

function readSessionConfig() {
  const formData = new FormData(elements.sessionForm);
  return {
    categoryIds: formData.getAll("sessionCategory").map(String),
    mode: String(formData.get("mode") ?? "random"),
    questionCount: String(formData.get("questionCount") ?? "20"),
    timer: Number(formData.get("timer") ?? 0)
  };
}

function startSession(event) {
  event?.preventDefault();
  startSessionWithConfig(readSessionConfig());
}

function startSessionWithConfig(config) {
  const availableCards = state.cards.filter((card) => config.categoryIds.includes(card.categoryId));
  if (!config.categoryIds.length || !availableCards.length) {
    elements.sessionError.textContent = "Select at least one category containing cards.";
    elements.sessionError.hidden = false;
    return;
  }

  elements.sessionError.hidden = true;
  const arranged = arrangeCards(availableCards, config.mode);
  const requestedCount = config.questionCount === "all"
    ? arranged.length
    : Math.min(Number(config.questionCount), arranged.length);
  const queue = arranged.slice(0, requestedCount);

  activeSession = {
    config,
    queue,
    currentIndex: 0,
    results: [],
    startedAt: new Date().toISOString(),
    questionStartedAt: 0,
    typed: "",
    revealed: false,
    locked: false,
    timerId: null,
    remainingMs: config.timer * 1000
  };
  lastSessionConfig = {
    ...config,
    categoryIds: [...config.categoryIds]
  };
  elements.sessionBuilder.hidden = true;
  elements.sessionResults.hidden = true;
  elements.questionStage.hidden = false;
  document.body.classList.add("session-active");
  showCurrentQuestion();
}

function currentCard() {
  return activeSession?.queue[activeSession.currentIndex] ?? null;
}

function showCurrentQuestion() {
  const card = currentCard();
  if (!card) {
    completeSession();
    return;
  }

  activeSession.typed = "";
  activeSession.revealed = false;
  activeSession.locked = false;
  activeSession.questionStartedAt = performance.now();
  activeSession.remainingMs = activeSession.config.timer * 1000;
  clearInterval(activeSession.timerId);

  const category = state.categories.find((item) => item.id === card.categoryId);
  const questionNumber = activeSession.currentIndex + 1;
  const total = activeSession.queue.length;
  elements.questionCategory.textContent = category?.name ?? "Uncategorised";
  elements.questionText.textContent = card.prompt;
  elements.questionProgressLabel.textContent = `${questionNumber} of ${total}`;
  elements.questionProgressBar.style.width = `${((questionNumber - 1) / total) * 100}%`;
  elements.typedAnswer.textContent = "Your answer";
  elements.typedAnswer.classList.add("answer-placeholder");
  elements.answerFeedback.hidden = true;
  elements.answerFeedback.textContent = "";
  elements.keypad.hidden = false;
  elements.revealActions.hidden = true;
  elements.timerPill.classList.remove("is-urgent");

  if (activeSession.config.timer > 0) {
    renderTimer();
    activeSession.timerId = setInterval(tickTimer, 100);
  } else {
    elements.timerPill.textContent = "∞";
  }
}

function tickTimer() {
  if (!activeSession || activeSession.locked || activeSession.revealed) return;
  const elapsed = performance.now() - activeSession.questionStartedAt;
  activeSession.remainingMs = Math.max(0, (activeSession.config.timer * 1000) - elapsed);
  renderTimer();
  if (activeSession.remainingMs <= 0) {
    finishAttempt({ correct: false, classification: "Timeout", reason: "Time ran out" });
  }
}

function renderTimer() {
  elements.timerPill.textContent = (activeSession.remainingMs / 1000).toFixed(1);
  elements.timerPill.classList.toggle("is-urgent", activeSession.remainingMs <= 3000);
}

function normalizeAnswer(value) {
  return String(value).trim().replaceAll(",", "").replace(/\s+/g, "").toLowerCase();
}

function answersMatch(entered, expected) {
  const normalizedEntered = normalizeAnswer(entered);
  const normalizedExpected = normalizeAnswer(expected);
  if (normalizedEntered === normalizedExpected) return true;
  const numericEntered = Number(normalizedEntered);
  const numericExpected = Number(normalizedExpected);
  return Number.isFinite(numericEntered) &&
    Number.isFinite(numericExpected) &&
    Math.abs(numericEntered - numericExpected) < 1e-10;
}

function classifyCorrect(responseMs) {
  if (responseMs <= 2500) return "Instant";
  if (responseMs <= 6000) return "Correct";
  return "Slow";
}

function submitTypedAnswer() {
  if (!activeSession || activeSession.locked || activeSession.revealed) return;
  if (!activeSession.typed) {
    showToast("Enter an answer first.");
    return;
  }
  const card = currentCard();
  const responseMs = performance.now() - activeSession.questionStartedAt;
  const correct = answersMatch(activeSession.typed, card.answer);
  finishAttempt({
    correct,
    classification: correct ? classifyCorrect(responseMs) : "Incorrect",
    reason: correct ? "Answered" : "Wrong answer",
    enteredAnswer: activeSession.typed
  });
}

function finishAttempt({ correct, classification, reason, enteredAnswer = "" }) {
  if (!activeSession || activeSession.locked) return;
  activeSession.locked = true;
  clearInterval(activeSession.timerId);
  const card = currentCard();
  const responseMs = Math.max(0, performance.now() - activeSession.questionStartedAt);
  const result = {
    cardId: card.id,
    prompt: card.prompt,
    expectedAnswer: card.answer,
    enteredAnswer,
    correct,
    classification,
    reason,
    responseMs: Math.round(responseMs)
  };
  activeSession.results.push(result);
  state = recordCardAttempt(state, card.id, result);

  elements.answerFeedback.hidden = false;
  elements.answerFeedback.textContent = correct
    ? classification
    : `${classification} · ${card.answer}`;
  elements.answerFeedback.className = correct ? "is-correct" : "is-incorrect";
  elements.typedAnswer.classList.add("answer-placeholder");
  elements.keypad.hidden = true;
  elements.revealActions.hidden = true;

  setTimeout(() => {
    if (!activeSession) return;
    activeSession.currentIndex += 1;
    showCurrentQuestion();
  }, 650);
}

function revealAnswer() {
  if (!activeSession || activeSession.locked || activeSession.revealed) return;
  activeSession.revealed = true;
  clearInterval(activeSession.timerId);
  const card = currentCard();
  elements.typedAnswer.textContent = card.answer;
  elements.typedAnswer.classList.remove("answer-placeholder");
  elements.answerFeedback.hidden = false;
  elements.answerFeedback.textContent = "Answer revealed";
  elements.answerFeedback.className = "";
  elements.keypad.hidden = true;
  elements.revealActions.hidden = false;
}

function completeRevealed(correct) {
  if (!activeSession?.revealed) return;
  const responseMs = performance.now() - activeSession.questionStartedAt;
  finishAttempt({
    correct,
    classification: correct ? classifyCorrect(responseMs) : "Incorrect",
    reason: "Answer revealed"
  });
}

function skipQuestion() {
  if (!activeSession || activeSession.locked) return;
  finishAttempt({ correct: false, classification: "Incorrect", reason: "Skipped" });
}

function dontKnow() {
  if (!activeSession || activeSession.locked) return;
  finishAttempt({ correct: false, classification: "Incorrect", reason: "Did not know" });
}

function completeSession() {
  clearInterval(activeSession?.timerId);
  const completed = activeSession;
  if (!completed) return;
  const correctResults = completed.results.filter((result) => result.correct);
  const averageMs = completed.results.length
    ? Math.round(completed.results.reduce((total, result) => total + result.responseMs, 0) / completed.results.length)
    : 0;
  const accuracy = completed.results.length
    ? Math.round((correctResults.length / completed.results.length) * 100)
    : 0;

  state = saveSessionResult(state, {
    startedAt: completed.startedAt,
    config: completed.config,
    questionCount: completed.results.length,
    correctCount: correctResults.length,
    accuracy,
    averageResponseTime: averageMs,
    results: completed.results
  });
  activeSession = null;
  document.body.classList.remove("session-active");
  elements.questionStage.hidden = true;
  elements.sessionResults.hidden = false;
  elements.resultsSummary.textContent = `You completed ${completed.results.length} questions with ${accuracy}% accuracy.`;
  elements.resultMetrics.innerHTML = `
    <article><strong>${accuracy}%</strong><span>Accuracy</span></article>
    <article><strong>${(averageMs / 1000).toFixed(1)}s</strong><span>Average time</span></article>
    <article><strong>${correctResults.length}/${completed.results.length}</strong><span>Correct</span></article>
  `;
  const classifications = ["Instant", "Correct", "Slow", "Incorrect", "Timeout"];
  elements.resultBreakdown.innerHTML = classifications.map((classification) => {
    const count = completed.results.filter((result) => result.classification === classification).length;
    return `<div><span>${classification}</span><strong>${count}</strong></div>`;
  }).join("");
  renderAll();
}

function exitSession() {
  if (!activeSession) return;
  if (!window.confirm("Exit this session? Current session results will not be saved.")) return;
  clearInterval(activeSession.timerId);
  activeSession = null;
  document.body.classList.remove("session-active");
  elements.questionStage.hidden = true;
  elements.sessionResults.hidden = true;
  elements.sessionBuilder.hidden = false;
}

function returnToBuilder() {
  elements.sessionResults.hidden = true;
  elements.questionStage.hidden = true;
  elements.sessionBuilder.hidden = false;
}

function handleKeypadClick(event) {
  const button = event.target.closest("[data-key]");
  if (!button || !activeSession || activeSession.locked || activeSession.revealed) return;
  const key = button.dataset.key;
  if (key === "backspace") {
    if (backspaceLongPressed) {
      backspaceLongPressed = false;
      return;
    }
    activeSession.typed = activeSession.typed.slice(1);
  } else if (key === "submit") {
    submitTypedAnswer();
    return;
  } else {
    activeSession.typed = `${key}${activeSession.typed}`;
  }
  elements.typedAnswer.textContent = activeSession.typed || "Your answer";
  elements.typedAnswer.classList.toggle("answer-placeholder", !activeSession.typed);
}

function beginBackspacePress(event) {
  if (!event.target.closest('[data-key="backspace"]')) return;
  backspaceLongPressed = false;
  longPressTimer = setTimeout(() => {
    if (!activeSession) return;
    activeSession.typed = "";
    backspaceLongPressed = true;
    elements.typedAnswer.textContent = "Your answer";
    elements.typedAnswer.classList.add("answer-placeholder");
    navigator.vibrate?.(20);
  }, 550);
}

function endBackspacePress() {
  clearTimeout(longPressTimer);
}

function beginQuestionGesture(event) {
  if (!activeSession || activeSession.locked) return;
  gestureStart = {
    x: event.clientX,
    y: event.clientY,
    longPressed: false
  };
  longPressTimer = setTimeout(() => {
    if (!gestureStart) return;
    gestureStart.longPressed = true;
    navigator.vibrate?.(20);
    revealAnswer();
  }, 650);
}

function moveQuestionGesture(event) {
  if (!gestureStart) return;
  if (Math.abs(event.clientX - gestureStart.x) > 15 || Math.abs(event.clientY - gestureStart.y) > 15) {
    clearTimeout(longPressTimer);
  }
}

function endQuestionGesture(event) {
  clearTimeout(longPressTimer);
  if (!gestureStart) return;
  const deltaX = event.clientX - gestureStart.x;
  const wasLongPress = gestureStart.longPressed;
  gestureStart = null;
  if (wasLongPress) return;
  if (deltaX >= 70) skipQuestion();
  else if (deltaX <= -70) dontKnow();
}

elements.themeButtons.forEach((button, index) => {
  button.addEventListener("click", () => saveTheme(button.dataset.themeChoice));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + elements.themeButtons.length) % elements.themeButtons.length;
    elements.themeButtons[nextIndex].focus();
    saveTheme(elements.themeButtons[nextIndex].dataset.themeChoice);
  });
});

document.querySelector("#add-category-button").addEventListener("click", () => openCategoryEditor());
document.querySelector("#add-card-button").addEventListener("click", () => openCardEditor(null, elements.categoryFilter.value));
document.querySelector("#close-dialog-button").addEventListener("click", closeEditorDialog);
document.querySelector("#cancel-dialog-button").addEventListener("click", closeEditorDialog);
elements.editorForm.addEventListener("submit", submitEditor);
elements.categoryStrip.addEventListener("click", handleCategoryAction);
elements.cardList.addEventListener("click", handleCardAction);
elements.search.addEventListener("input", renderCards);
elements.categoryFilter.addEventListener("change", renderCards);
elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCardFilter = button.dataset.cardFilter;
    elements.filterButtons.forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button))
    );
    renderCards();
  });
});
document.querySelector("#preview-import-button").addEventListener("click", previewImport);
document.querySelector("#confirm-import-button").addEventListener("click", confirmImport);
document.querySelector("#clear-import-button").addEventListener("click", () => {
  previewPairs = [];
  elements.importText.value = "";
  elements.importPreview.hidden = true;
  elements.importText.focus();
});
elements.sessionForm.addEventListener("submit", startSession);
document.querySelector("#toggle-all-categories").addEventListener("click", (event) => {
  const checkboxes = [...elements.sessionCategoryGrid.querySelectorAll('input[type="checkbox"]:not(:disabled)')];
  const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);
  checkboxes.forEach((checkbox) => {
    checkbox.checked = shouldSelect;
  });
  event.currentTarget.textContent = shouldSelect ? "Clear all" : "Select all";
});
document.querySelector("#exit-session-button").addEventListener("click", exitSession);
document.querySelector("#skip-question-button").addEventListener("click", skipQuestion);
document.querySelector("#dont-know-button").addEventListener("click", dontKnow);
document.querySelector("#reveal-answer-button").addEventListener("click", revealAnswer);
document.querySelector("#revealed-right-button").addEventListener("click", () => completeRevealed(true));
document.querySelector("#revealed-wrong-button").addEventListener("click", () => completeRevealed(false));
document.querySelector("#back-to-builder-button").addEventListener("click", returnToBuilder);
document.querySelector("#repeat-session-button").addEventListener("click", () => {
  if (lastSessionConfig) startSessionWithConfig(lastSessionConfig);
});
elements.keypad.addEventListener("click", handleKeypadClick);
elements.keypad.addEventListener("pointerdown", beginBackspacePress);
elements.keypad.addEventListener("pointerup", endBackspacePress);
elements.keypad.addEventListener("pointercancel", endBackspacePress);
elements.keypad.addEventListener("pointerleave", endBackspacePress);
elements.questionSurface.addEventListener("pointerdown", beginQuestionGesture);
elements.questionSurface.addEventListener("pointermove", moveQuestionGesture);
elements.questionSurface.addEventListener("pointerup", endQuestionGesture);
elements.questionSurface.addEventListener("pointercancel", () => {
  clearTimeout(longPressTimer);
  gestureStart = null;
});

systemTheme.addEventListener("change", () => {
  if (getStoredTheme() === "system") applyTheme("system");
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("online", renderConnectionStatus);
window.addEventListener("offline", renderConnectionStatus);

applyTheme(getStoredTheme());
renderRoute();
renderConnectionStatus();
renderAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      console.error(`Recall ${APP_VERSION}: service worker registration failed.`, error);
    }
  });
}
