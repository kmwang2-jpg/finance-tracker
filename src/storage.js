import { normalizeCashFlowItem } from './recurrence';

const STORAGE_KEYS = {
  categories: 'pf:categories',
  cashflows: 'pf:cashflows',
  actuals: 'pf:actuals',
  goals: 'pf:goals',
  debts: 'pf:debts',
  taxableEvents: 'pf:taxableEvents'
};

const defaultCategories = [
  { id: 1, name: 'Income', type: 'income', parentCategoryId: null },
  { id: 2, name: 'Housing', type: 'expense', parentCategoryId: null },
  { id: 3, name: 'Utilities', type: 'expense', parentCategoryId: null },
  { id: 4, name: 'Food', type: 'expense', parentCategoryId: null },
  { id: 5, name: 'Transportation', type: 'expense', parentCategoryId: null },
  { id: 6, name: 'Debt', type: 'expense', parentCategoryId: null },
  { id: 7, name: 'Savings', type: 'expense', parentCategoryId: null },
  { id: 8, name: 'Taxes', type: 'expense', parentCategoryId: null }
];

const defaultCashflows = [
  {
    id: 1,
    name: 'Primary Salary',
    description: 'Monthly pay',
    categoryId: 1,
    type: 'income',
    amount: 5200,
    recurrence: { interval: 1, unit: 'months', anchor: '2026-01-01' },
    startDate: '2026-01-01',
    endDate: null,
    isActive: true
  },
  {
    id: 2,
    name: 'Rent',
    description: 'Apartment rent',
    categoryId: 2,
    type: 'expense',
    amount: 1500,
    recurrence: { interval: 1, unit: 'months', anchor: '2026-01-01' },
    startDate: '2026-01-01',
    endDate: null,
    isActive: true
  },
  {
    id: 3,
    name: 'Groceries',
    description: 'Weekly groceries',
    categoryId: 4,
    type: 'expense',
    amount: 180,
    recurrence: { interval: 1, unit: 'weeks', anchor: 'Friday' },
    startDate: '2026-01-01',
    endDate: null,
    isActive: true
  },
  {
    id: 4,
    name: 'Savings Contribution',
    description: 'Emergency fund saving',
    categoryId: 7,
    type: 'savings_contribution',
    amount: 300,
    recurrence: { interval: 1, unit: 'months', anchor: '2026-01-01' },
    startDate: '2026-01-01',
    endDate: null,
    isActive: true
  }
];

const defaultActuals = [
  { id: 1, year: 2026, month: 4, categoryId: 4, actualAmount: 620, type: 'expense', note: 'Higher grocery spend' },
  { id: 2, year: 2026, month: 4, categoryId: 3, actualAmount: 118, type: 'expense', note: 'Lower utility usage' },
  { id: 3, year: 2026, month: 5, categoryId: 1, actualAmount: 6900, type: 'income', note: 'Bonus included' }
];

const defaultGoals = [
  { id: 1, name: 'Emergency Fund', targetAmount: 12000, targetDate: '2026-12-31', currentBalance: 5200 }
];

const defaultDebts = [
  { id: 1, name: 'Student Loan', principal: 18500, interestRate: 5.8, minimumPayment: 240, extraPayment: 50, balance: 18500 }
];

const defaultTaxableEvents = [
  { id: 1, date: '2026-01-15', eventType: 'interest_income', description: 'Savings account interest', amount: 12.45 }
];

function loadStorage(key, defaultValue) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return defaultValue;
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
}

function saveStorage(key, value) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

function nextId(items) {
  return items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

export function loadCategories() {
  const saved = loadStorage(STORAGE_KEYS.categories, defaultCategories);
  const normalized = saved.map((category) => ({
    ...category,
    type: category.type || (category.name === 'Income' ? 'income' : 'expense'),
    parentCategoryId: category.parentCategoryId ?? null
  }));

  if (JSON.stringify(normalized) !== JSON.stringify(saved)) {
    saveCategories(normalized);
  }

  return normalized;
}

export function loadCashFlows() {
  const saved = loadStorage(STORAGE_KEYS.cashflows, defaultCashflows);
  const normalized = saved.map(normalizeCashFlowItem);
  if (JSON.stringify(normalized) !== JSON.stringify(saved)) {
    saveCashFlows(normalized);
  }
  return normalized;
}

export function loadActuals() {
  return loadStorage(STORAGE_KEYS.actuals, defaultActuals);
}

export function loadGoals() {
  return loadStorage(STORAGE_KEYS.goals, defaultGoals);
}

export function loadDebts() {
  return loadStorage(STORAGE_KEYS.debts, defaultDebts);
}

export function loadTaxableEvents() {
  return loadStorage(STORAGE_KEYS.taxableEvents, defaultTaxableEvents);
}

export function saveCategories(categories) {
  saveStorage(STORAGE_KEYS.categories, categories);
}

export function saveCashFlows(cashflows) {
  saveStorage(STORAGE_KEYS.cashflows, cashflows);
}

export function saveActuals(actuals) {
  saveStorage(STORAGE_KEYS.actuals, actuals);
}

export function saveGoals(goals) {
  saveStorage(STORAGE_KEYS.goals, goals);
}

export function createCategory(payload) {
  const categories = loadCategories();
  const next = nextId(categories);
  const newCategory = { id: next, ...payload };
  saveCategories([...categories, newCategory]);
  return newCategory;
}

export function updateCategory(id, payload) {
  const categories = loadCategories();
  const updated = categories.map((category) => (category.id === id ? { ...category, ...payload, id } : category));
  saveCategories(updated);
  return updated.find((category) => category.id === id) ?? null;
}

export function deleteCategory(id) {
  const categories = loadCategories();
  const updatedCategories = categories.filter((category) => category.id !== id);
  saveCategories(updatedCategories);

  const cashflows = loadCashFlows();
  const updatedCashflows = cashflows.map((item) => (item.categoryId === id ? { ...item, categoryId: null } : item));
  saveCashFlows(updatedCashflows);

  return { categories: updatedCategories, cashflows: updatedCashflows };
}

export function saveDebts(debts) {
  saveStorage(STORAGE_KEYS.debts, debts);
}

export function saveTaxableEvents(events) {
  saveStorage(STORAGE_KEYS.taxableEvents, events);
}

export function createCashFlowItem(payload) {
  const items = loadCashFlows();
  const next = nextId(items);
  const newItem = { id: next, ...payload };
  saveCashFlows([...items, newItem]);
  return newItem;
}

export function createSavingsGoal(payload) {
  const items = loadGoals();
  const next = nextId(items);
  const newItem = { id: next, ...payload };
  saveGoals([...items, newItem]);
  return newItem;
}

export function createDebtAccount(payload) {
  const items = loadDebts();
  const next = nextId(items);
  const newItem = { id: next, ...payload };
  saveDebts([...items, newItem]);
  return newItem;
}

export function createTaxableEvent(payload) {
  const items = loadTaxableEvents();
  const next = nextId(items);
  const newItem = { id: next, ...payload };
  saveTaxableEvents([...items, newItem]);
  return newItem;
}

export function updateCashFlowItem(id, payload) {
  const items = loadCashFlows();
  const updated = items.map((item) => (item.id === id ? { ...item, ...payload, id } : item));
  saveCashFlows(updated);
  return updated.find((item) => item.id === id) ?? null;
}
