const DAY_MS = 24 * 60 * 60 * 1000;

export function veteransWeekRange(year) {
  const veteransDay = new Date(year, 10, 11, 12);
  const start = new Date(veteransDay);
  start.setDate(veteransDay.getDate() - veteransDay.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function seasonForDate(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();

  if (month === 9) return 'halloween';
  if (month === 11) return 'christmas';

  if (month === 10) {
    const { start, end } = veteransWeekRange(date.getFullYear());
    const value = new Date(date.getFullYear(), month, day, 12).getTime();
    if (value >= start.getTime() && value < end.getTime() + DAY_MS) return 'veterans';
  }

  return 'lights';
}

export function dateFromPreview(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}
