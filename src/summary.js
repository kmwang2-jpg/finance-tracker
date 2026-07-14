const FREQUENCY_MULTIPLIERS = {
  one_time: 0,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  semiannual: 1 / 6,
  annual: 1 / 12
};

function monthLabel(year, month) {
  return `${new Date(year, month - 1).toLocaleString(undefined, { month: 'short' })} ${year}`;
}

function isActiveInMonth(item, year, month) {
  const start = new Date(item.startDate);
  const end = item.endDate ? new Date(item.endDate) : null;
  const target = new Date(year, month - 1, 1);
  if (start > new Date(year, month, 0)) return false;
  if (end && end < target) return false;
  return true;
}

function cashflowAmountForMonth(item, year, month) {
  if (!isActiveInMonth(item, year, month)) {
    return 0;
  }

  if (item.frequency === 'one_time') {
    const eventDate = new Date(item.startDate);
    return eventDate.getFullYear() === year && eventDate.getMonth() + 1 === month ? item.amount : 0;
  }

  return item.amount * (FREQUENCY_MULTIPLIERS[item.frequency] ?? 0);
}

function buildMonthData(year, month, cashflows) {
  const byCategory = new Map();
  let income = 0;
  let expenses = 0;
  let debtPayments = 0;
  let savingsContributions = 0;
  let transfers = 0;

  cashflows.forEach((item) => {
    const amount = cashflowAmountForMonth(item, year, month);
    if (amount === 0) return;

    const current = byCategory.get(item.categoryId) ?? 0;
    byCategory.set(item.categoryId, current + amount);

    if (item.type === 'income') {
      income += amount;
    } else if (item.type === 'expense') {
      expenses += amount;
    } else if (item.type === 'debt_payment') {
      debtPayments += amount;
    } else if (item.type === 'savings_contribution') {
      savingsContributions += amount;
    } else if (item.type === 'transfer') {
      transfers += amount;
    }
  });

  return {
    month,
    year,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    label: monthLabel(year, month),
    income,
    expenses,
    transfers,
    debtPayments,
    savingsContributions,
    netCashFlow: income - expenses - debtPayments - savingsContributions,
    byCategory: Array.from(byCategory.entries()).map(([categoryId, amount]) => ({ categoryId, amount }))
  };
}

function getActualsByMonth(actuals) {
  return actuals.reduce((acc, actual) => {
    const key = `${actual.year}-${String(actual.month).padStart(2, '0')}`;
    const existing = acc.get(key) ?? 0;
    acc.set(key, existing + actual.actualAmount);
    return acc;
  }, new Map());
}

export function buildSummary(params) {
  const { year, month, startingBalance, cashflows, actuals, goals, debts, events } = params;

  const currentMonth = buildMonthData(year, month, cashflows);

  const annualProjection = Array.from({ length: 12 }, (_, index) => {
    const projectedMonth = month + index;
    const projectedYear = year + Math.floor((projectedMonth - 1) / 12);
    const adjustedMonth = ((projectedMonth - 1) % 12) + 1;
    return buildMonthData(projectedYear, adjustedMonth, cashflows);
  });

  const forecast = [];
  let runningBalance = startingBalance;

  annualProjection.forEach((projection) => {
    runningBalance += projection.netCashFlow;
    forecast.push({
      monthKey: projection.monthKey,
      label: projection.label,
      projectedNet: projection.netCashFlow,
      runningBalance,
      inflows: projection.income,
      outflows: projection.expenses + projection.debtPayments + projection.savingsContributions
    });
  });

  const actualsByMonth = getActualsByMonth(actuals);
  const monthKeys = new Set(actuals.map((item) => `${item.year}-${String(item.month).padStart(2, '0')}`));
  const reconciliation = Array.from(monthKeys)
    .sort()
    .map((monthKey) => {
      const [actualYear, actualMonth] = monthKey.split('-').map(Number);
      const projected = buildMonthData(actualYear, actualMonth, cashflows).netCashFlow;
      return {
        monthKey,
        label: monthLabel(actualYear, actualMonth),
        projected,
        actual: actualsByMonth.get(monthKey) ?? 0,
        variance: (actualsByMonth.get(monthKey) ?? 0) - projected
      };
    });

  return {
    currentMonth,
    annualProjection,
    forecast,
    reconciliation,
    savingsGoals: goals,
    debtAccounts: debts,
    taxableEvents: events
  };
}
