/** "Montréal " -> "montreal", so a city spelt with or without its accent still joins. */
function place(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/** "2026-09-30" moved by a number of days, still as a date string. */
function shiftDay(day, days) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400e3).toISOString().slice(0, 10);
}

/**
 * The entry of our hand-kept calendar (proxy/tennis-calendar.json) that a
 * catalogue tournament is, on a match's day; undefined when none is.
 *
 * The feed knows the China Open only as "Beijing" and has no dates, so the
 * join is on what both sides do have: the tour, the town (the feed's city, or
 * its name when the city is missing, as it often is the town), and the week.
 * The week is widened by three days before, for qualifying and for a match
 * whose UTC day is the eve of its local one, and one after. A tournament with
 * no town is matched on its country instead, but only when a single entry of
 * that tour is on there that week, so two events never get each other's name.
 */
export function calendarEntry(calendar, { tour, info, day }) {
  if (!Array.isArray(calendar) || !tour || !info || !/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return undefined;
  const on = calendar.filter((c) => c?.tour === tour && c.start && c.end && shiftDay(c.start, -3) <= day && day <= shiftDay(c.end, 1));
  const towns = [info.city, info.name].map(place).filter(Boolean);
  const byTown = on.find((c) => towns.includes(place(c.city)));
  if (byTown) return byTown;
  const country = String(info.country || "").toUpperCase();
  const byCountry = country ? on.filter((c) => String(c.country || "").toUpperCase() === country) : [];
  return byCountry.length === 1 ? byCountry[0] : undefined;
}
