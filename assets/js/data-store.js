const STORAGE_KEY = "recall.data.v1";
const SCHEMA_VERSION = 1;

const DEFAULT_CATEGORY_NAMES = [
  "Multiplication",
  "Division",
  "Addition",
  "Subtraction",
  "Fractions",
  "Decimal to Fraction",
  "Fraction to Decimal",
  "Percentages",
  "Squares",
  "Cubes",
  "Powers",
  "Roots",
  "Pythagorean Triplets",
  "Prime Numbers",
  "Factorials",
  "Logarithms",
  "CAT Benchmarks",
  "Custom"
];

function createId(prefix) {
  const uniquePart = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uniquePart}`;
}

function now() {
  return new Date().toISOString();
}

function makeCategory(name, isDefault = false) {
  return {
    id: createId("category"),
    name,
    isDefault,
    createdAt: now(),
    updatedAt: now()
  };
}

function makeCard(categoryId, prompt, answer) {
  return {
    id: createId("card"),
    categoryId,
    prompt: String(prompt).trim(),
    answer: String(answer).trim(),
    favourite: false,
    practice: false,
    createdAt: now(),
    updatedAt: now(),
    stats: {
      timesSeen: 0,
      timesCorrect: 0,
      timesIncorrect: 0,
      averageResponseTime: 0,
      ease: 2.5,
      mastery: 0,
      confidence: 0,
      lastSeen: null,
      lastCorrect: null,
      currentStreak: 0,
      adaptivePriority: 1
    }
  };
}

function categoryByName(categories, name) {
  return categories.find((category) => category.name === name);
}

function buildStarterCards(categories) {
  const cards = [];
  const add = (categoryName, prompt, answer) => {
    const category = categoryByName(categories, categoryName);
    cards.push(makeCard(category.id, prompt, answer));
  };

  for (let left = 2; left <= 20; left += 1) {
    for (let right = 2; right <= 20; right += 1) {
      add("Multiplication", `${left} × ${right}`, left * right);
    }
  }

  for (let number = 1; number <= 30; number += 1) {
    add("Squares", `${number}²`, number ** 2);
  }

  for (let number = 1; number <= 15; number += 1) {
    add("Cubes", `${number}³`, number ** 3);
  }

  [
    ["1/2", "0.5"],
    ["1/3", "0.3333"],
    ["2/3", "0.6667"],
    ["1/4", "0.25"],
    ["3/4", "0.75"],
    ["1/5", "0.2"],
    ["2/5", "0.4"],
    ["3/5", "0.6"],
    ["4/5", "0.8"],
    ["1/8", "0.125"],
    ["3/8", "0.375"],
    ["5/8", "0.625"],
    ["7/8", "0.875"],
    ["1/16", "0.0625"],
    ["3/16", "0.1875"],
    ["5/16", "0.3125"],
    ["7/16", "0.4375"]
  ].forEach(([fraction, decimal]) => {
    add("Fraction to Decimal", fraction, decimal);
    add("Decimal to Fraction", decimal, fraction);
  });

  [
    [10, "1/10"],
    [12.5, "1/8"],
    [20, "1/5"],
    [25, "1/4"],
    [33.33, "1/3"],
    [40, "2/5"],
    [50, "1/2"],
    [60, "3/5"],
    [66.67, "2/3"],
    [75, "3/4"],
    [80, "4/5"]
  ].forEach(([percent, fraction]) => add("Percentages", `${percent}%`, fraction));

  [
    [3, 4, 5],
    [5, 12, 13],
    [7, 24, 25],
    [8, 15, 17],
    [9, 40, 41],
    [12, 35, 37],
    [20, 21, 29]
  ].forEach(([a, b, c]) => add("Pythagorean Triplets", `${a}, ${b}, ?`, c));

  [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]
    .forEach((prime, index, list) => add("Prime Numbers", `${index + 1}${ordinal(index + 1)} prime`, prime));

  let factorial = 1;
  for (let number = 1; number <= 10; number += 1) {
    factorial *= number;
    add("Factorials", `${number}!`, factorial);
  }

  return cards;
}

function ordinal(number) {
  if (number % 10 === 1 && number % 100 !== 11) return "st";
  if (number % 10 === 2 && number % 100 !== 12) return "nd";
  if (number % 10 === 3 && number % 100 !== 13) return "rd";
  return "th";
}

function createInitialState() {
  const categories = DEFAULT_CATEGORY_NAMES.map((name) => makeCategory(name, true));
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now(),
    updatedAt: now(),
    categories,
    cards: buildStarterCards(categories),
    sessions: []
  };
}

function isValidState(value) {
  return Boolean(
    value &&
    value.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(value.categories) &&
    Array.isArray(value.cards)
  );
}

export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const initial = createInitialState();
      saveData(initial);
      return initial;
    }

    const parsed = JSON.parse(stored);
    if (!isValidState(parsed)) throw new Error("Unsupported data format.");
    return { ...parsed, sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
  } catch (error) {
    console.error("Recall could not load saved data. A safe starter library was created.", error);
    const initial = createInitialState();
    saveData(initial);
    return initial;
  }
}

export function saveData(state) {
  const nextState = { ...state, schemaVersion: SCHEMA_VERSION, updatedAt: now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function createCategory(state, name) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Enter a category name.");
  if (state.categories.some((item) => item.name.toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error("A category with that name already exists.");
  }
  return saveData({ ...state, categories: [...state.categories, makeCategory(normalizedName)] });
}

export function updateCategory(state, id, name) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Enter a category name.");
  if (state.categories.some((item) => item.id !== id && item.name.toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error("A category with that name already exists.");
  }
  return saveData({
    ...state,
    categories: state.categories.map((item) =>
      item.id === id ? { ...item, name: normalizedName, updatedAt: now() } : item
    )
  });
}

export function deleteCategory(state, id) {
  return saveData({
    ...state,
    categories: state.categories.filter((item) => item.id !== id),
    cards: state.cards.filter((card) => card.categoryId !== id)
  });
}

export function createCard(state, values) {
  validateCard(state, values);
  return saveData({
    ...state,
    cards: [...state.cards, makeCard(values.categoryId, values.prompt, values.answer)]
  });
}

export function updateCard(state, id, values) {
  validateCard(state, values);
  return saveData({
    ...state,
    cards: state.cards.map((card) =>
      card.id === id
        ? {
            ...card,
            categoryId: values.categoryId,
            prompt: values.prompt.trim(),
            answer: values.answer.trim(),
            updatedAt: now()
          }
        : card
    )
  });
}

function validateCard(state, values) {
  if (!state.categories.some((category) => category.id === values.categoryId)) {
    throw new Error("Choose a category.");
  }
  if (!values.prompt.trim()) throw new Error("Enter a question.");
  if (!values.answer.trim()) throw new Error("Enter an answer.");
}

export function duplicateCard(state, id) {
  const original = state.cards.find((card) => card.id === id);
  if (!original) return state;
  const duplicate = {
    ...makeCard(original.categoryId, original.prompt, original.answer),
    favourite: original.favourite,
    practice: original.practice
  };
  return saveData({ ...state, cards: [...state.cards, duplicate] });
}

export function deleteCard(state, id) {
  return saveData({ ...state, cards: state.cards.filter((card) => card.id !== id) });
}

export function toggleCardFlag(state, id, flag) {
  if (!["favourite", "practice"].includes(flag)) return state;
  return saveData({
    ...state,
    cards: state.cards.map((card) =>
      card.id === id ? { ...card, [flag]: !card[flag], updatedAt: now() } : card
    )
  });
}

export function importCards(state, categoryId, pairs) {
  if (!state.categories.some((category) => category.id === categoryId)) {
    throw new Error("Choose a category.");
  }
  const cards = pairs.map(({ prompt, answer }) => makeCard(categoryId, prompt, answer));
  return saveData({ ...state, cards: [...state.cards, ...cards] });
}

export function parseCardText(text) {
  const pairs = [];
  const errors = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1 || separatorIndex === line.length - 1) {
      errors.push(`Line ${index + 1} needs a question, an equals sign, and an answer.`);
      return;
    }
    const prompt = line.slice(0, separatorIndex).trim();
    const answer = line.slice(separatorIndex + 1).trim();
    if (!prompt || !answer) {
      errors.push(`Line ${index + 1} is incomplete.`);
      return;
    }
    pairs.push({ prompt, answer });
  });

  return { pairs, errors };
}

export function recordCardAttempt(state, cardId, attempt) {
  return saveData({
    ...state,
    cards: state.cards.map((card) => {
      if (card.id !== cardId) return card;
      const previous = card.stats ?? makeCard(card.categoryId, card.prompt, card.answer).stats;
      const timesSeen = previous.timesSeen + 1;
      const timesCorrect = previous.timesCorrect + (attempt.correct ? 1 : 0);
      const timesIncorrect = previous.timesIncorrect + (attempt.correct ? 0 : 1);
      const averageResponseTime = previous.timesSeen
        ? Math.round(((previous.averageResponseTime * previous.timesSeen) + attempt.responseMs) / timesSeen)
        : Math.round(attempt.responseMs);
      const mastery = Math.max(0, Math.min(100, previous.mastery + (attempt.correct ? 5 : -8)));
      const confidence = Math.max(0, Math.min(100, previous.confidence + (attempt.correct ? 4 : -7)));
      return {
        ...card,
        updatedAt: now(),
        stats: {
          ...previous,
          timesSeen,
          timesCorrect,
          timesIncorrect,
          averageResponseTime,
          ease: Math.max(1.3, Math.min(3, previous.ease + (attempt.correct ? 0.05 : -0.2))),
          mastery,
          confidence,
          lastSeen: now(),
          lastCorrect: attempt.correct ? now() : previous.lastCorrect,
          currentStreak: attempt.correct ? previous.currentStreak + 1 : 0,
          adaptivePriority: Math.max(0.1, 1 + ((100 - mastery) / 50) + (attempt.correct ? 0 : 1))
        }
      };
    })
  });
}

export function saveSessionResult(state, session) {
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  return saveData({
    ...state,
    sessions: [
      ...sessions,
      {
        id: createId("session"),
        completedAt: now(),
        ...session
      }
    ]
  });
}
