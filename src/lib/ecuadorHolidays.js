function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function transferredHoliday(year, month, day) {
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  if (weekday === 2) return addDays(date, -1);
  if (weekday === 3 || weekday === 4) return addDays(date, 5 - weekday);
  if (weekday === 6) return addDays(date, -1);
  if (weekday === 0) return addDays(date, 1);
  return date;
}

export function nationalHolidays(year) {
  const easter = easterSunday(year);
  const holidays = [
    new Date(year, 0, 1),
    addDays(easter, -48),
    addDays(easter, -47),
    addDays(easter, -2),
    transferredHoliday(year, 5, 1),
    transferredHoliday(year, 5, 24),
    transferredHoliday(year, 8, 10),
    transferredHoliday(year, 10, 9),
    transferredHoliday(year, 11, 2),
    transferredHoliday(year, 11, 3),
    new Date(year, 11, 25),
  ];
  return new Set(holidays.map(isoDate));
}

export function isAvailableInstallationDate(value) {
  if (!value) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return false;
  return !nationalHolidays(year).has(value);
}

export function todayIso() {
  return isoDate(new Date());
}
