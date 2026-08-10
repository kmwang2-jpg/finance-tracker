import { countOccurrencesInMonth } from './recurrence.js';
import { generateForecast } from './lib/finance/forecast.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

function toLocalDate(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  return new Date(value);
}

export function monthKeyFromDate(value = new Date()) {
  const date = toLocalDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return { year, month };
}

export function formatMonthLabel(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function monthStart(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1);
}

function monthEnd(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function monthDelta(monthKey, delta) {
  const start = monthStart(monthKey);
  const moved = new Date(start.getFullYear(), start.getMonth() + delta, 1);
  return monthKeyFromDate(moved);
}

function rangeMonthKeys(startKey, endKey) {
  const values = [];
  let current = startKey;
  while (current <= endKey) {
    values.push(current);
    current = monthDelta(current, 1);
  }
  return values;
}

function buildMonthData(year, month, context) {
  const byCategory = new Map();
  let income = 0;
  let expenses = 0;

  const categoryById = new Map((context.categories ?? []).map((category) => [category.id, category]));
  const monthKey = `${year}-${pad(month)}`;
  const overrides = new Map((context.history?.timelineOverrides ?? []).map((entry) => [
    `${entry.targetKind}:${entry.targetId}:${entry.monthKey}`,
    entry
  ]));

  context.cashflows.forEach((item) => {
    const occurrences = countOccurrencesInMonth(item, year, month);
    const override = overrides.get(`cashflow:${item.id}:${monthKey}`);
    const amount = override ? Number(override.amount ?? 0) : Number(item.amount ?? 0) * occurrences;
    if (!amount) return;

    const existing = byCategory.get(item.categoryId) ?? 0;
    byCategory.set(item.categoryId, existing + amount);

    const itemType = item.type ?? categoryById.get(item.categoryId)?.type ?? 'expense';
    if (itemType === 'income') {
      income += amount;
    } else {
      expenses += amount;
    }
  });

  return {
    monthKey,
    label: new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    income,
    expenses,
    netCashFlow: income - expenses,
    byCategory: Array.from(byCategory.entries()).map(([categoryId, amount]) => ({ categoryId, amount }))
  };
}

function transactionsForMonth(transactions, monthKey) {
  const start = monthStart(monthKey);
  const end = monthEnd(monthKey);
  return transactions.filter((entry) => {
    const date = toLocalDate(entry.date);
    return date >= start && date <= end;
  });
}

function sumByType(records, type) {
  return records
    .filter((entry) => entry.type === type)
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
}

function sumByCategory(records, type) {
  const map = new Map();
  records
    .filter((entry) => !type || entry.type === type)
    .forEach((entry) => {
      const key = entry.categoryId ?? 'uncategorized';
      const current = map.get(key) ?? 0;
      map.set(key, current + Number(entry.amount ?? 0));
    });

  return map;
}

function aggregateForecastByMonth(events) {
  const map = new Map();
  events.forEach((event) => {
    if (!event || !event.date) return;
    const monthKey = event.date.slice(0, 7);
    const bucket = map.get(monthKey) ?? { income: 0, expenses: 0 };
    const amount = Number(event.amount ?? 0);
    if (event.type === 'income') {
      bucket.income += amount;
    } else {
      bucket.expenses += amount;
    }
    map.set(monthKey, bucket);
  });
  return map;
}

function buildExpectedByCategory(monthData) {
  const map = new Map();
  monthData.byCategory.forEach((entry) => {
    map.set(entry.categoryId ?? 'uncategorized', Number(entry.amount ?? 0));
  });
  return map;
}

function buildVarianceRows(monthData, monthlyTransactions, categories) {
  const expectedMap = buildExpectedByCategory(monthData);
  const actualMap = sumByCategory(monthlyTransactions, 'expense');
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const keys = new Set([...expectedMap.keys(), ...actualMap.keys()]);
  return Array.from(keys).map((key) => {
    const expected = Math.abs(Number(expectedMap.get(key) ?? 0));
    const actual = Math.abs(Number(actualMap.get(key) ?? 0));
    return {
      categoryId: key,
      categoryName: key === 'uncategorized' ? 'Uncategorized' : (categoryById.get(key)?.name ?? 'Uncategorized'),
      expected,
      actual,
      variance: actual - expected
    };
  }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

function buildSavingsState(monthKey, goals, history) {
  const end = monthEnd(monthKey);
  const stateByGoal = {};
  const totals = { balance: 0, contribution: 0, withdrawal: 0 };

  goals.forEach((goal) => {
    const startingBalance = Number(goal.startingBalance ?? goal.currentBalance ?? 0);
    const events = history.savingsEvents.filter((event) => Number(event.goalId) === Number(goal.id) && toLocalDate(event.date) <= end);
    const txEvents = history.transactions.filter((event) => Number(event.linkedGoalId) === Number(goal.id) && toLocalDate(event.date) <= end);
    const scopedEvents = events.filter((event) => toLocalDate(event.date) <= end);

    const contributions = scopedEvents
      .filter((event) => event.eventType === 'contribution')
      .reduce((sum, event) => sum + Number(event.amount ?? 0), 0)
      + txEvents
        .filter((event) => event.type === 'savings_contribution')
        .reduce((sum, event) => sum + Number(event.amount ?? 0), 0);

    const withdrawals = scopedEvents
      .filter((event) => event.eventType === 'withdrawal')
      .reduce((sum, event) => sum + Number(event.amount ?? 0), 0)
      + txEvents
        .filter((event) => event.type === 'savings_withdrawal')
        .reduce((sum, event) => sum + Number(event.amount ?? 0), 0);

    const adjustments = history.adjustments
      .filter((event) => event.targetType === 'savings_goal' && Number(event.targetId) === Number(goal.id) && toLocalDate(event.date) <= end)
      .reduce((sum, event) => sum + Number(event.amount ?? 0), 0);

    const balance = Math.max(0, startingBalance + contributions - withdrawals + adjustments);

    stateByGoal[goal.id] = {
      goalId: goal.id,
      balance,
      contribution: contributions,
      withdrawal: withdrawals,
      targetAmount: Number(goal.targetAmount ?? 0),
      progress: Number(goal.targetAmount ?? 0) > 0 ? Math.min(1, balance / Number(goal.targetAmount)) : 0
    };

    totals.balance += balance;
    totals.contribution += contributions;
    totals.withdrawal += withdrawals;
  });

  return { totals, byGoal: stateByGoal };
}

function buildDebtState(monthKey, debts, history) {
  const end = monthEnd(monthKey);
  const byDebt = {};
  const totals = { balance: 0, principalPaid: 0, interestPaid: 0, totalPaid: 0 };

  debts.forEach((debt) => {
    const startingBalance = Number(debt.startingBalance ?? debt.balance ?? debt.principal ?? 0);
    const payments = history.debtPayments.filter((payment) => Number(payment.debtId) === Number(debt.id) && toLocalDate(payment.date) <= end);
    const principalPaid = payments.reduce((sum, payment) => sum + Number(payment.principalAmount ?? 0), 0);
    const interestPaid = payments.reduce((sum, payment) => sum + Number(payment.interestAmount ?? 0), 0);
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.totalAmount ?? 0), 0);

    const adjustments = history.adjustments
      .filter((event) => event.targetType === 'debt' && Number(event.targetId) === Number(debt.id) && toLocalDate(event.date) <= end)
      .reduce((sum, event) => sum + Number(event.amount ?? 0), 0);

    const balance = Math.max(0, startingBalance - principalPaid + adjustments);

    byDebt[debt.id] = {
      debtId: debt.id,
      balance,
      principalPaid,
      interestPaid,
      totalPaid,
      progress: startingBalance > 0 ? 1 - Math.min(1, balance / startingBalance) : 0
    };

    totals.balance += balance;
    totals.principalPaid += principalPaid;
    totals.interestPaid += interestPaid;
    totals.totalPaid += totalPaid;
  });

  return { totals, byDebt };
}

function buildNetWorth(monthSummary, savingsState, debtState) {
  return {
    assets: savingsState.totals.balance,
    liabilities: debtState.totals.balance,
    netWorth: savingsState.totals.balance - debtState.totals.balance,
    cashFlow: monthSummary.netCashFlow
  };
}

function buildSnapshot(monthKey, context) {
  const { year, month } = parseMonthKey(monthKey);
  const expected = buildMonthData(year, month, context);
  const monthlyTransactions = transactionsForMonth(context.history.transactions, monthKey);
  const actualIncome = sumByType(monthlyTransactions, 'income');
  const actualExpenses = sumByType(monthlyTransactions, 'expense');
  const savingsState = buildSavingsState(monthKey, context.goals, context.history);
  const debtState = buildDebtState(monthKey, context.debts, context.history);
  const netWorth = buildNetWorth(expected, savingsState, debtState);

  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    expected,
    actual: {
      income: actualIncome,
      expenses: actualExpenses,
      cashFlow: actualIncome - actualExpenses,
      transactions: monthlyTransactions
    },
    categoryBreakdown: {
      expected: expected.byCategory,
      actual: Array.from(sumByCategory(monthlyTransactions, 'expense').entries()).map(([categoryId, amount]) => ({ categoryId, amount })),
      varianceRows: buildVarianceRows(expected, monthlyTransactions, context.categories)
    },
    savings: savingsState,
    debt: debtState,
    netWorth
  };
}

export function buildTimelineEngine({ categories, cashflows, goals, debts, history }, options = {}) {
  const now = options.now ? toLocalDate(options.now) : new Date();
  const nowKey = monthKeyFromDate(now);
  const monthsBack = Number(options.monthsBack ?? 18);
  const monthsForward = Number(options.monthsForward ?? 12);
  const startingBalance = Number(options.startingBalance ?? 0);

  const transactionMonthKeys = history.transactions.map((entry) => monthKeyFromDate(entry.date));
  const savingsMonthKeys = history.savingsEvents.map((entry) => monthKeyFromDate(entry.date));
  const debtMonthKeys = history.debtPayments.map((entry) => monthKeyFromDate(entry.date));
  const overrideMonthKeys = (history.timelineOverrides ?? []).map((entry) => entry.monthKey).filter(Boolean);
  const allHistoryMonthKeys = [...transactionMonthKeys, ...savingsMonthKeys, ...debtMonthKeys, ...overrideMonthKeys].filter(Boolean).sort();

  const firstHistoryKey = allHistoryMonthKeys[0] ?? monthDelta(nowKey, -monthsBack);
  const startKey = firstHistoryKey < monthDelta(nowKey, -monthsBack) ? firstHistoryKey : monthDelta(nowKey, -monthsBack);
  const endKey = monthDelta(nowKey, monthsForward);
  const monthKeys = rangeMonthKeys(startKey, endKey);

  const snapshots = new Map();
  monthKeys.forEach((monthKey) => {
    snapshots.set(monthKey, buildSnapshot(monthKey, { categories, cashflows, goals, debts, history }));
  });

  const startMonth = parseMonthKey(startKey);
  const endMonth = parseMonthKey(endKey);
  const forecastStart = `${startMonth.year}-${pad(startMonth.month)}-01`;
  const forecastEnd = `${endMonth.year}-${pad(endMonth.month)}-${pad(new Date(endMonth.year, endMonth.month, 0).getDate())}`;
  const forecastEvents = generateForecast(cashflows, forecastStart, forecastEnd);
  const forecastByMonth = aggregateForecastByMonth(forecastEvents);

  const historySeries = monthKeys.map((monthKey) => {
    const snapshot = snapshots.get(monthKey);
    return {
      monthKey,
      label: new Date(parseMonthKey(monthKey).year, parseMonthKey(monthKey).month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      expectedCashFlow: snapshot.expected.netCashFlow,
      actualCashFlow: snapshot.actual.cashFlow,
      savings: snapshot.savings.totals.balance,
      debt: snapshot.debt.totals.balance,
      netWorth: snapshot.netWorth.netWorth
    };
  });

  let runningBalance = startingBalance;
  const projectionSeries = monthKeys
    .filter((monthKey) => monthKey >= nowKey)
    .slice(0, 12)
    .map((monthKey) => {
      const forecastTotals = forecastByMonth.get(monthKey) ?? { income: 0, expenses: 0 };
      const expectedNet = Number(forecastTotals.income ?? 0) - Number(forecastTotals.expenses ?? 0);
      runningBalance += expectedNet;
      return {
        monthKey,
        label: new Date(parseMonthKey(monthKey).year, parseMonthKey(monthKey).month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        expectedNet,
        expectedIncome: Number(forecastTotals.income ?? 0),
        expectedExpenses: Number(forecastTotals.expenses ?? 0),
        runningBalance
      };
    });

  function getMonthSummary(monthKey) {
    return snapshots.get(monthKey) ?? snapshots.get(nowKey);
  }

  function getSavingsState(monthKey) {
    return getMonthSummary(monthKey).savings;
  }

  function getDebtState(monthKey) {
    return getMonthSummary(monthKey).debt;
  }

  function getCashFlow(monthKey) {
    const summary = getMonthSummary(monthKey);
    return {
      expected: summary.expected.netCashFlow,
      actual: summary.actual.cashFlow,
      income: summary.expected.income,
      expenses: summary.expected.expenses
    };
  }

  function getNetWorth(monthKey) {
    return getMonthSummary(monthKey).netWorth;
  }

  function getCategoryBreakdown(monthKey) {
    return getMonthSummary(monthKey).categoryBreakdown;
  }

  function getLedger(monthKey, filters = {}) {
    const source = monthKey ? transactionsForMonth(history.transactions, monthKey) : history.transactions;
    return source
      .filter((entry) => {
        if (filters.type && entry.type !== filters.type) return false;
        if (filters.eventSubtype && (entry.eventSubtype ?? 'general') !== filters.eventSubtype) return false;
        if (filters.categoryId && Number(entry.categoryId) !== Number(filters.categoryId)) return false;
        if (filters.minAmount != null && Number(entry.amount) < Number(filters.minAmount)) return false;
        if (filters.maxAmount != null && Number(entry.amount) > Number(filters.maxAmount)) return false;
        if (filters.search) {
          const q = String(filters.search).toLowerCase();
          const hay = `${entry.notes ?? ''} ${entry.type ?? ''} ${entry.eventSubtype ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filters.startDate && toLocalDate(entry.date) < toLocalDate(filters.startDate)) return false;
        if (filters.endDate && toLocalDate(entry.date) > toLocalDate(filters.endDate)) return false;
        return true;
      })
      .sort((left, right) => toLocalDate(right.date) - toLocalDate(left.date));
  }

  function getMonthlySnapshots() {
    return monthKeys.map((monthKey) => snapshots.get(monthKey));
  }

  return {
    nowKey,
    startingBalance,
    monthKeys,
    historySeries,
    projectionSeries,
    getMonthSummary,
    getSavingsState,
    getDebtState,
    getCashFlow,
    getNetWorth,
    getCategoryBreakdown,
    getLedger,
    getMonthlySnapshots
  };
}
