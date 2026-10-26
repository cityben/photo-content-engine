/**
 * Time helpers. The business runs on UK time, so scheduling and display use
 * Europe/London (override with APP_TIMEZONE). Buffer wants ISO-8601 with an
 * offset; UTC "Z" timestamps satisfy that.
 */

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/London";

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Minutes the zone is ahead of UTC at `date` (60 during BST, 0 in winter). */
export function zoneOffsetMinutes(date, timeZone = APP_TIMEZONE) {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "2026-11-03T09:30" wall-clock time in `timeZone` → Date. */
export function zonedToDate(local, timeZone = APP_TIMEZONE) {
  const [d, t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, day, hh, mm));
  const offset = zoneOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Re-check across DST boundaries.
  const corrected = zoneOffsetMinutes(result, timeZone);
  return corrected === offset ? result : new Date(guess.getTime() - corrected * 60000);
}

/** Date → "2026-11-03T09:30" in `timeZone`, for datetime-local inputs. */
export function dateToZonedInput(date, timeZone = APP_TIMEZONE) {
  const p = partsInZone(new Date(date), timeZone);
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Calendar day key "2026-11-03" for a timestamp, in `timeZone`. */
export function dayKey(date, timeZone = APP_TIMEZONE) {
  return dateToZonedInput(date, timeZone).slice(0, 10);
}

export function formatDateTime(date, options = {}, timeZone = APP_TIMEZONE) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(new Date(date));
}

export function formatTime(date, timeZone = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(
    new Date(date)
  );
}

/** Default publishing slots (UK time), weekdays. */
export const QUEUE_SLOTS = ["08:30", "12:30", "17:30"];
export const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // 0 = Sunday … 6 = Saturday

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" day key. */
export function weekdayOf(key) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/**
 * Next free publishing slot after `after`, skipping times in `taken` (ISO
 * strings). `schedule` = { days: [0-6], times: ["08:30", …] } in `timeZone`.
 */
export function nextQueueSlot(after = new Date(), taken = [], timeZone = APP_TIMEZONE, schedule = {}) {
  const days = schedule.days?.length ? schedule.days : DEFAULT_DAYS;
  const times = [...(schedule.times?.length ? schedule.times : QUEUE_SLOTS)].sort();
  const takenSet = new Set(taken.map((t) => new Date(t).getTime()));
  const start = new Date(after);
  for (let dayOffset = 0; dayOffset < 120; dayOffset++) {
    const day = new Date(start.getTime() + dayOffset * 86400000);
    const key = dayKey(day, timeZone);
    if (!days.includes(weekdayOf(key))) continue;
    for (const slot of times) {
      const when = zonedToDate(`${key}T${slot}`, timeZone);
      if (when.getTime() > start.getTime() + 5 * 60000 && !takenSet.has(when.getTime())) {
        return when;
      }
    }
  }
  return new Date(start.getTime() + 86400000);
}
