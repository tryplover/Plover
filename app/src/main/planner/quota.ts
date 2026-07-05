export const FREE_WEEKLY_TASK_LIMIT = 10;

export function getWeekBoundaries(now: Date): { weekStart: Date; weekEnd: Date } {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);

  const dayOfWeek = weekStart.getDay();
  const daysBackToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setDate(weekStart.getDate() - daysBackToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { weekStart, weekEnd };
}

export function isWithinWeeklyTaskQuota(
  plan: 'paid' | 'free',
  tasksCreatedThisWeek: number,
  tasksAboutToCreate: number,
): boolean {
  if (plan === 'paid') return true;
  return tasksCreatedThisWeek + tasksAboutToCreate <= FREE_WEEKLY_TASK_LIMIT;
}
