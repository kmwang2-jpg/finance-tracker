import { parseIsoDate, formatIsoDate } from '../../recurrence.js';

export function buildProjectedEvent({ recurringRule, date, overrideAmount = null }) {
  return {
    recurringRuleId: recurringRule.id,
    date,
    amount: Number(overrideAmount ?? recurringRule.amount ?? 0),
    type: recurringRule.type,
    categoryId: recurringRule.categoryId ?? null,
    description: recurringRule.description ?? recurringRule.name,
    occurrenceKey: `${recurringRule.id}:${date}`
  };
}

export function generateForecast(recurringRules, startDate, endDate) {
  const projectedEvents = [];
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || !Array.isArray(recurringRules)) {
    return [];
  }

  recurringRules.forEach((rule) => {
    if (!rule || rule.isActive === false) {
      return;
    }

    const ruleStart = rule.startDate ? parseIsoDate(rule.startDate) : null;
    const ruleEnd = rule.endDate ? parseIsoDate(rule.endDate) : null;

    if (!rule.recurrence) {
      if (!rule.startDate) {
        return;
      }
      const occurrenceDate = parseIsoDate(rule.startDate);
      if (!occurrenceDate) {
        return;
      }
      if (occurrenceDate < start || occurrenceDate > end) {
        return;
      }
      if (ruleStart && occurrenceDate < ruleStart) {
        return;
      }
      if (ruleEnd && occurrenceDate > ruleEnd) {
        return;
      }
      projectedEvents.push(buildProjectedEvent({ recurringRule: rule, date: formatIsoDate(occurrenceDate) }));
      return;
    }

    if (!rule.recurrence.anchor || !rule.recurrence.unit) {
      return;
    }

    const anchorDate = parseIsoDate(rule.recurrence.anchor);
    if (!anchorDate) {
      return;
    }

    const occurrences = [];

    if (rule.recurrence.unit === 'years') {
      const interval = Number(rule.recurrence.interval ?? 1);
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      for (let year = startYear - interval; year <= endYear + interval; year += interval) {
        const candidate = new Date(year, anchorDate.getMonth(), anchorDate.getDate());
        if (candidate.getMonth() !== anchorDate.getMonth()) {
          const lastDay = new Date(year, anchorDate.getMonth() + 1, 0);
          candidate.setDate(lastDay.getDate());
        }
        if (candidate < start || candidate > end) continue;
        if (ruleStart && candidate < ruleStart) continue;
        if (ruleEnd && candidate > ruleEnd) continue;
        occurrences.push(candidate);
      }
    } else if (rule.recurrence.unit === 'months') {
      const interval = Number(rule.recurrence.interval ?? 1);
      const anchorMonthIndex = anchorDate.getMonth();
      const anchorYear = anchorDate.getFullYear();
      const anchorDay = anchorDate.getDate();
      const startMonthIndex = start.getFullYear() * 12 + start.getMonth();
      const endMonthIndex = end.getFullYear() * 12 + end.getMonth();
      for (let monthIndex = startMonthIndex; monthIndex <= endMonthIndex; monthIndex += 1) {
        const monthsDiff = monthIndex - (anchorYear * 12 + anchorMonthIndex);
        if (monthsDiff < 0 || monthsDiff % interval !== 0) continue;
        const year = Math.floor(monthIndex / 12);
        const month = monthIndex % 12;
        const candidate = new Date(year, month, anchorDay);
        if (candidate.getMonth() !== month) {
          const lastDay = new Date(year, month + 1, 0);
          candidate.setDate(lastDay.getDate());
        }
        if (candidate < start || candidate > end) continue;
        if (ruleStart && candidate < ruleStart) continue;
        if (ruleEnd && candidate > ruleEnd) continue;
        occurrences.push(candidate);
      }
    }

    occurrences.forEach((occurrence) => {
      projectedEvents.push(buildProjectedEvent({ recurringRule: rule, date: formatIsoDate(occurrence) }));
    });
  });

  return projectedEvents.sort((a, b) => a.date.localeCompare(b.date));
}
