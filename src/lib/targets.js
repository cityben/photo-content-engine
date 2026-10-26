/**
 * Posting targets: the publishing schedule says which days each channel
 * posts and how many posts a posting day needs. From that and the posts in
 * Buffer this works out, for today, this week, this month and this year:
 * target, published, booked, how far ahead or behind, the pace for the
 * year, and the specific things to do next (with the approved post that
 * would close each gap).
 *
 * computeTargets() is pure (tested in tests/targets.test.js); targetsData()
 * loads the inputs.
 */

import { APP_TIMEZONE, dayKey, formatTime, weekdayOf } from "./time";

const DAY_MS = 864e5;
const addKey = (key, n) => new Date(Date.parse(`${key}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const keysBetween = (from, to) => {
  const out = [];
  for (let k = from; k <= to; k = addKey(k, 1)) out.push(k);
  return out;
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAY = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function periodsFor(today) {
  const wd = weekdayOf(today);
  const monday = addKey(today, -((wd + 6) % 7));
  const [y, m] = today.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return {
    today: { label: "Today", from: today, to: today },
    week: { label: "This week", from: monday, to: addKey(monday, 6) },
    month: { label: new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }), from: `${today.slice(0, 7)}-01`, to: monthEnd },
    year: { label: today.slice(0, 4), from: `${y}-01-01`, to: `${y}-12-31` },
  };
}

const postKey = (p, tz) => dayKey(new Date(p.sentAt || p.dueAt), tz);

/**
 * schedule: { linkedin: { days, times, perDay }, … }
 * posts:    Buffer posts (any status) covering at least this year
 * ready:    approved, unscheduled job posts ({ jobId, jobTitle, service })
 * pending:  jobs with a written but unapproved post ({ jobId, jobTitle, service })
 * ideas:    pipeline ideas not started ({ id, title })
 */
export function computeTargets({ schedule, posts = [], ready = [], pending = [], ideas = [], now = new Date(), tz = APP_TIMEZONE, labels = {}, since = null }) {
  const today = dayKey(now, tz);
  const start = since && since <= today ? since : null;
  const periods = periodsFor(today);
  const label = (s) => labels[s] || s;

  const services = Object.entries(schedule).map(([service, sch]) => {
    const perDay = Math.max(1, sch.perDay || 1);
    // Days before targets were set don't count against you.
    const isDay = (key) => sch.days.includes(weekdayOf(key)) && (!start || key >= start);
    const own = posts.filter((p) => p.service === service);
    const count = (key, statuses) => own.filter((p) => statuses.includes(p.status) && postKey(p, tz) === key).length;
    const sentOn = (key) => count(key, ["sent"]);
    const bookedOn = (key) => count(key, ["scheduled", "sending"]);

    const summarise = (period) => {
      const keys = keysBetween(period.from, period.to);
      const postingDays = keys.filter(isDay);
      const target = postingDays.length * perDay;
      let sent = 0;
      let booked = 0;
      let failed = 0;
      let dueToDate = 0;
      let doneToDate = 0;
      const openDays = [];
      for (const k of keys) {
        const s = sentOn(k);
        const b = bookedOn(k);
        sent += s;
        booked += b;
        failed += count(k, ["error"]);
        if (isDay(k)) {
          if (k <= today) {
            dueToDate += perDay;
            doneToDate += Math.min(perDay, s + (k === today ? b : 0));
          }
          if (k >= today && s + b < perDay) openDays.push({ key: k, missing: perDay - s - b });
        }
      }
      const behind = Math.max(0, dueToDate - doneToDate);
      const covered = sent + booked;
      const status = target === 0 ? "rest" : behind > 0 ? "behind" : covered >= target ? "covered" : "on-track";
      return { target, sent, booked, failed, covered, dueToDate, behind, remaining: Math.max(0, target - covered), openDays, postingDays: postingDays.length, status };
    };

    const byPeriod = Object.fromEntries(Object.entries(periods).map(([id, p]) => [id, summarise(p)]));

    // Pace: share of past posting-day targets actually met, projected to year end.
    const y = byPeriod.year;
    const pastDue = y.dueToDate - (isDay(today) ? perDay : 0);
    const pastSent = own.filter((p) => p.status === "sent" && postKey(p, tz) < today && postKey(p, tz) >= periods.year.from).length;
    const hitRate = pastDue > 0 ? Math.min(1, pastSent / pastDue) : null;
    const futureTarget = y.target - y.dueToDate;
    const projected = Math.round(y.sent + y.booked + (hitRate ?? 1) * Math.max(0, futureTarget - y.booked));

    // Streak: consecutive past posting days that met the target.
    let streak = 0;
    for (let k = addKey(today, -1), guard = 0; guard < 370; k = addKey(k, -1), guard++) {
      if (!isDay(k)) continue;
      if (sentOn(k) >= perDay) streak += 1;
      else break;
    }

    // Runway: how many open slots the approved posts cover.
    const readyHere = ready.filter((r) => r.service === service);
    const openSlots = byPeriod.month.openDays.flatMap((d) => Array(d.missing).fill(d.key)).concat(
      byPeriod.month.to < addKey(today, 13) ? keysBetween(addKey(byPeriod.month.to, 1), addKey(today, 13)).filter(isDay).flatMap((k) => Array(perDay).fill(k)) : []
    );
    const runsOutOn = readyHere.length < openSlots.length ? openSlots[readyHere.length] : null;

    return { service, perDay, days: sch.days, times: sch.times, isPostingDay: isDay(today), periods: byPeriod, hitRate, projected, streak, ready: readyHere.length, runsOutOn };
  });

  /* --- What to do, most urgent first ------------------------------------- */
  const actions = [];
  const nowTime = formatTime(now, tz);
  for (const s of services) {
    const name = label(s.service);
    const t = s.periods.today;
    const readyHere = ready.filter((r) => r.service === s.service);
    const pendingHere = pending.filter((p) => p.service === s.service);
    const laterToday = s.times.find((time) => time > nowTime);
    let used = 0;
    const fix = (when) => {
      const item = readyHere[used];
      if (item) {
        used += 1;
        return { kind: "schedule", item, when, cta: `Schedule “${item.jobTitle}”` };
      }
      const p = pendingHere[used - readyHere.length];
      if (p) {
        used += 1;
        return { kind: "approve", jobId: p.jobId, cta: `Approve the ${name} post on “${p.jobTitle}”` };
      }
      return ideas[0] ? { kind: "idea", ideaId: ideas[0].id, cta: `Start a job from “${ideas[0].title}”` } : { kind: "new", cta: "Create a job" };
    };

    if (s.isPostingDay && t.covered < s.perDay) {
      const missing = s.perDay - t.covered;
      const when = laterToday ? `${dayKey(now, tz)}T${laterToday}` : null;
      actions.push({
        id: `${s.service}-today`,
        severity: "high",
        service: s.service,
        title: `${name}: ${missing} ${missing === 1 ? "post" : "posts"} short today`,
        detail: `${DAY_NAMES[weekdayOf(dayKey(now, tz))]} is ${/^[aeiou]/i.test(name) ? "an" : "a"} ${name} day (target ${s.perDay}). ${t.sent} published, ${t.booked} booked.${laterToday ? ` The ${laterToday} slot is still open.` : " Today's slots have passed — book the next one so the week stays on target."}`,
        ...fix(when),
      });
    }
    const w = s.periods.week;
    const futureOpen = w.openDays.filter((d) => d.key > dayKey(now, tz));
    if (futureOpen.length) {
      const missing = futureOpen.reduce((n, d) => n + d.missing, 0);
      actions.push({
        id: `${s.service}-week`,
        severity: w.behind > 0 ? "high" : "medium",
        service: s.service,
        title: `${name}: ${missing} open ${missing === 1 ? "slot" : "slots"} left this week`,
        detail: `${futureOpen.map((d) => SHORT_DAY(d.key)).join(", ")} ${futureOpen.length === 1 ? "has" : "have"} nothing booked.${w.behind ? ` Already ${w.behind} behind this week.` : ""}`,
        ...fix(`${futureOpen[0].key}T${s.times[0]}`),
      });
    }
    if (s.runsOutOn && s.ready < 3) {
      actions.push({
        id: `${s.service}-runway`,
        severity: "medium",
        service: s.service,
        title: `${name}: approved posts run out ${SHORT_DAY(s.runsOutOn)}`,
        detail: `${s.ready} approved ${s.ready === 1 ? "post covers" : "posts cover"} the slots up to then. Approve or write ${Math.max(1, 3 - s.ready)} more to stay a fortnight ahead.`,
        ...(pendingHere[0] ? { kind: "approve", jobId: pendingHere[0].jobId, cta: `Approve “${pendingHere[0].jobTitle}”` } : ideas[0] ? { kind: "idea", ideaId: ideas[0].id, cta: `Start from “${ideas[0].title}”` } : { kind: "new", cta: "Create a job" }),
      });
    }
    if (s.hitRate != null && s.hitRate < 0.8 && s.periods.year.target > 0) {
      actions.push({
        id: `${s.service}-pace`,
        severity: "low",
        service: s.service,
        title: `${name}: on pace for ${s.projected} of ${s.periods.year.target} this year`,
        detail: `${Math.round(s.hitRate * 100)}% of posting days have been met so far. Keep two weeks of approved posts in the tray and use Auto-fill to book them.`,
        kind: "none",
      });
    }
    if (s.periods.week.failed > 0) {
      actions.unshift({
        id: `${s.service}-failed`,
        severity: "high",
        service: s.service,
        title: `${name}: ${s.periods.week.failed} failed ${s.periods.week.failed === 1 ? "post" : "posts"} this week`,
        detail: "Open it on the calendar to see Buffer's error, fix and reschedule.",
        kind: "none",
      });
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => order[a.severity] - order[b.severity]);

  return { today, since: start, periods, services, actions };
}

/** Load everything computeTargets needs (server only). */
export async function targetsData() {
  const [{ getSchedule, targetsSince }, { listPosts }, { listJobs, readyToSchedule }, { listIdeas }, { hasSubstance }, { serviceInfo }] = await Promise.all([
    import("./schedule"),
    import("./social"),
    import("./jobs"),
    import("./ideas"),
    import("./content"),
    import("./ui-labels"),
  ]);
  const now = new Date();
  const y = now.getUTCFullYear();
  const [schedule, since, posts, ready, jobs, ideas] = await Promise.all([
    getSchedule(),
    targetsSince(),
    listPosts({ start: new Date(Date.UTC(y, 0, 1)).toISOString(), end: new Date(Date.UTC(y + 1, 0, 1)).toISOString(), statuses: ["scheduled", "sending", "sent", "error"], maxPages: 10 }),
    readyToSchedule(),
    listJobs(),
    listIdeas().catch(() => []),
  ]);
  const services = Object.keys(schedule);
  const pending = jobs.flatMap((j) =>
    services.filter((s) => !j.approvals?.[s] && hasSubstance(s, j.content?.[s]) && !(j.posts || []).some((p) => p.service === s)).map((s) => ({ jobId: j.id, jobTitle: j.title, service: s }))
  );
  // Never set: count from the first job, or from this week.
  const firstJob = jobs.map((j) => j.createdAt).filter(Boolean).sort()[0];
  const start = since || (firstJob ? dayKey(new Date(firstJob)) : periodsFor(dayKey(now)).week.from);
  const open = ideas.filter((i) => ["idea", "planned"].includes(i.status)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return computeTargets({ schedule, posts, ready, pending, ideas: open, now, since: start, labels: Object.fromEntries(services.map((s) => [s, serviceInfo(s).label])) });
}
