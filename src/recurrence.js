const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function pad(value) {
  return String(value).padStart(2, '0');
}

export function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getWeekdayName(date) {
  const day = date.getDay();
  return day === 0 ? 'Sunday' : WEEKDAYS[day - 1];
}

export function weekdayIndex(name) {
  return WEEKDAYS.indexOf(name) + 1;
}

export function normalizeCashFlowItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const normalized = { ...item };
  if (Object.prototype.hasOwnProperty.call(normalized, 'recurrence')) {
    return normalized;
  }

  const startDate = typeof normalized.startDate === 'string' ? normalized.startDate : null;
  const recurrence = {
    one_time: null,
    weekly: { interval: 1, unit: 'weeks', anchor: startDate ? getWeekdayName(parseIsoDate(startDate)) : 'Monday' },
    biweekly: { interval: 2, unit: 'weeks', anchor: startDate ? getWeekdayName(parseIsoDate(startDate)) : 'Monday' },
    monthly: { interval: 1, unit: 'months', anchor: startDate },
    quarterly: { interval: 3, unit: 'months', anchor: startDate },
    semiannual: { interval: 6, unit: 'months', anchor: startDate },
    annual: { interval: 1, unit: 'years', anchor: startDate }
  }[normalized.frequency ?? 'one_time'];

  normalized.recurrence = recurrence ?? null;
  delete normalized.frequency;
  return normalized;
}

function addDays(date, amount) {
  return new Date(date.getTime() + amount * MS_PER_DAY);
}

function addMonthsPreservingDay(date, amount) {
  const targetMonth = date.getMonth() + amount;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const monthIndex = ((targetMonth % 12) + 12) % 12;
  const day = date.getDate();
  const candidate = new Date(targetYear, monthIndex, day);
  if (candidate.getMonth() !== monthIndex) {
    return new Date(targetYear, monthIndex + 1, 0);
  }
  return candidate;
}

function addYearsPreservingDay(date, amount) {
  const targetYear = date.getFullYear() + amount;
  const month = date.getMonth();
  const day = date.getDate();
  const candidate = new Date(targetYear, month, day);
  if (candidate.getMonth() !== month) {
    return new Date(targetYear, month + 1, 0);
  }
  return candidate;
}

function isSameMonthYear(date, year, month) {
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

function dateAtStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getRecurrenceDescription(item) {
  if (!item || item.recurrence == null) {
    return item?.startDate ? `One-time on ${item.startDate}` : 'One-time';
  }

  const recurrence = item.recurrence;
  const interval = recurrence.interval || 1;
  const unit = recurrence.unit;
  const anchor = recurrence.anchor;

  if (unit === 'days') {
    return `Every ${interval} day${interval === 1 ? '' : 's'} starting ${anchor}`;
  }

  if (unit === 'weeks') {
    return `Every ${interval} week${interval === 1 ? '' : 's'} on ${anchor}`;
  }

  if (unit === 'months') {
    const anchorDate = parseIsoDate(anchor);
    if (interval === 1 && anchorDate) {
      return `Every month on day ${anchorDate.getDate()}`;
    }
    return `Every ${interval} month${interval === 1 ? '' : 's'} starting ${anchorDate ? formatIsoDate(anchorDate) : anchor}`;
  }

  if (unit === 'years') {
    const anchorDate = parseIsoDate(anchor);
    if (anchorDate) {
      return `Every ${interval} year${interval === 1 ? '' : 's'} on ${anchorDate.getMonth() + 1}/${anchorDate.getDate()}`;
    }
    return `Every ${interval} year${interval === 1 ? '' : 's'}`;
  }

  return 'Recurring';
}

export function countOccurrencesInMonth(item, year, month) {
  if (!item) {
    return 0;
  }

  const startDate = item.startDate ? parseIsoDate(item.startDate) : null;
  const endDate = item.endDate ? parseIsoDate(item.endDate) : null;
  const recurrence = item.recurrence ?? null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  if (recurrence == null) {
    if (!startDate) {
      return 0;
    }
    return isSameMonthYear(startDate, year, month) && (!endDate || startDate <= endDate) ? 1 : 0;
  }

  if (!startDate || !recurrence.unit) {
    return 0;
  }

  if (endDate && monthStart > endDate) {
    return 0;
  }

  if (startDate > monthEnd) {
    return 0;
  }

  if (recurrence.unit === 'days') {
    const anchorDate = parseIsoDate(recurrence.anchor);
    if (!anchorDate) {
      return 0;
    }

    const afterStart = startDate > anchorDate ? startDate : anchorDate;
    const offsetDays = Math.max(0, Math.ceil((dateAtStartOfDay(afterStart) - dateAtStartOfDay(anchorDate)) / MS_PER_DAY / recurrence.interval));
    let candidate = addDays(anchorDate, offsetDays * recurrence.interval);
    let count = 0;

    while (candidate <= monthEnd && (!endDate || candidate <= endDate)) {
      if (candidate >= afterStart && isSameMonthYear(candidate, year, month)) {
        count += 1;
      }
      candidate = addDays(candidate, recurrence.interval);
    }

    return count;
  }

  if (recurrence.unit === 'weeks') {
    const anchorWeekday = weekdayIndex(recurrence.anchor);
    if (anchorWeekday < 1) {
      return 0;
    }

    const activeStart = startDate;
    const firstCandidate = getNextWeekday(activeStart, anchorWeekday);
    if (endDate && firstCandidate > endDate) {
      return 0;
    }

    let candidate = firstCandidate;
    while (candidate < monthStart) {
      candidate = addDays(candidate, recurrence.interval * DAYS_PER_WEEK);
    }

    let count = 0;
    while (candidate <= monthEnd && (!endDate || candidate <= endDate)) {
      if (isSameMonthYear(candidate, year, month)) {
        count += 1;
      }
      candidate = addDays(candidate, recurrence.interval * DAYS_PER_WEEK);
    }

    return count;
  }

  if (recurrence.unit === 'months') {
    const anchorDate = parseIsoDate(recurrence.anchor);
    if (!anchorDate) {
      return 0;
    }

    const monthsDiff = (year - anchorDate.getFullYear()) * 12 + (month - (anchorDate.getMonth() + 1));
    if (monthsDiff < 0 || monthsDiff % recurrence.interval !== 0) {
      return 0;
    }

    const candidate = addMonthsPreservingDay(anchorDate, monthsDiff);
    if (!isSameMonthYear(candidate, year, month) || candidate < startDate || (endDate && candidate > endDate)) {
      return 0;
    }

    return 1;
  }

  if (recurrence.unit === 'years') {
    const anchorDate = parseIsoDate(recurrence.anchor);
    if (!anchorDate) {
      return 0;
    }

    const yearsDiff = year - anchorDate.getFullYear();
    if (yearsDiff < 0 || yearsDiff % recurrence.interval !== 0) {
      return 0;
    }

    const candidate = addYearsPreservingDay(anchorDate, yearsDiff);
    if (!isSameMonthYear(candidate, year, month) || candidate < startDate || (endDate && candidate > endDate)) {
      return 0;
    }

    return 1;
  }

  return 0;
}

function getNextWeekday(date, weekday) {
  const currentIsoDay = date.getDay() === 0 ? 7 : date.getDay();
  const delta = (weekday - currentIsoDay + 7) % 7;
  return addDays(date, delta);
}

export const RECURRENCE_UNITS = ['one_time', 'days', 'weeks', 'months', 'years'];
export const WEEKDAY_OPTIONS = WEEKDAYS;
