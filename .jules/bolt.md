# Bolt's Optimization Journal

## 2026-05-24 - [Initial Journal]
**Learning:** Initial setup of Bolt's performance optimization journal.
**Action:** Keep track of critical learnings, codebase-specific performance patterns, or rejected optimizations here.

## 2026-05-24 - [Optimize Task Scheduling Slot Loop]
**Learning:** The task scheduling core logic ('scheduleTasks' in 'app/src/main/planner/schedule.ts') iterates over each day in a horizon (e.g., 14 days) and attempts to find a valid slot. Checking for overlaps with calendar events and already scheduled tasks previously scanned the ENTIRE dataset (horizon-wide). Since candidates for a day only ever reside inside that specific day, we can pre-filter these events and tasks relative to the day boundaries. This reduces time complexity from O(total_events + total_tasks) to O(daily_events + daily_tasks).
**Action:** Apply pre-filtering to temporal/interval search loops when the search range is partitioned by day.
