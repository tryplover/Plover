const DAY = 86400000;
const MIN = 60000;

const TITLES: [string, string[]][] = [
  [
    "Write the intro of my history essay",
    ["Outline three points", "Draft the hook", "Write thesis sentence"],
  ],
  [
    "Fix the login bug",
    ["Reproduce it", "Write a failing test", "Patch the token refresh"],
  ],
  [
    "Read chapter 4 of biology",
    ["Skim headings", "Take notes", "Do review questions"],
  ],
  ["Prepare slides for Friday", ["Collect charts", "Write speaker notes"]],
  ["Clean up the inbox", ["Archive newsletters", "Reply to Sam"]],
  [
    "Study for the stats quiz",
    ["Practice set A", "Practice set B", "Formula sheet"],
  ],
  ["Draft the project proposal", ["Problem statement", "Timeline", "Budget"]],
  ["Edit the essay conclusion", ["Tighten wording", "Check citations"]],
];

export function seedHistory(now: number) {
  const tasks: Record<string, unknown>[] = [];
  const sessions: Record<string, unknown>[] = [];
  let n = 0;
  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);
  for (let d = 13; d >= 0; d--) {
    const day = today0.getTime() - d * DAY;
    const cyclesToday = d === 0 ? 2 : ([1, 2, 3, 0, 2, 1, 3][d % 7] ?? 0);
    let t = day + (9 + (d % 3)) * 60 * MIN;
    for (let c = 0; c < cyclesToday; c++) {
      const [title, steps] = TITLES[n % TITLES.length] as [string, string[]];
      n++;
      const taskId = "task-" + n;
      const cycleId = "cycle-" + n;
      const blocks = 2 + ((n + d) % 3);
      for (let b = 0; b < blocks; b++) {
        if (d === 0 && t + 25 * MIN > now) break;
        const paused = (n + b) % 4 === 0 ? 3 * MIN : 0;
        const cut = (n + b) % 7 === 3;
        const len = cut ? 14 * MIN : 25 * MIN;
        sessions.push({
          id: `s${sessions.length}`,
          taskId,
          phase: "work",
          startedAt: t,
          endedAt: t + len + paused,
          completed: !cut,
          cycleId,
          pausedMs: paused,
          taskTitle: title,
        });
        t += len + paused;
        const long = b === 3;
        const blen = long ? 15 * MIN : 5 * MIN;
        const skipped = (n + b) % 5 === 2;
        if (b < blocks - 1 || long) {
          const e = skipped ? t + 2 * MIN : t + blen;
          sessions.push({
            id: `s${sessions.length}`,
            taskId,
            phase: long ? "longBreak" : "shortBreak",
            startedAt: t,
            endedAt: e,
            completed: !skipped,
            cycleId,
            pausedMs: 0,
            taskTitle: title,
            ...(skipped && { skipped: true }),
          });
          t = e;
        }
      }
      tasks.push({
        id: taskId,
        title,
        steps: steps.map((s, i) => ({
          id: `${taskId}-${i}`,
          title: s,
          done: true,
        })),
        createdAt: t - 3 * 3600000,
        doneAt: t,
        parked: null,
        lastActiveAt: t,
      });
      t += 90 * MIN;
    }
  }
  tasks.push({
    id: "open-1",
    title: "Plan next week",
    steps: [{ id: "o1", title: "List deadlines", done: false }],
    createdAt: now - 3600000,
    doneAt: null,
    parked: null,
    lastActiveAt: now - 3600000,
  });
  return { tasks, sessions };
}
