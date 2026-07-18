# Bolt Journal - Critical Learnings Only

## 2025-07-18 - Daily Schedule Slot-checking Optimization
**Learning:** In local-first productivity apps like Plover, the task auto-scheduler (`scheduleTasks`) searches day-by-day for suitable open slots. Doing O(total_events + total_tasks) overlap comparisons in the inner while loop of each day becomes incredibly expensive when the schedule length (horizonDays) or event count grows. Pre-filtering the global calendar events and scheduled tasks down to only those occurring on the specific day currently being evaluated drops the complexity per slot-check down to O(daily_events + daily_tasks).
**Action:** Always pre-filter global timelines or interval datasets to the relevant day's bounds inside the outer loop, before executing nested fine-grained search or slot allocation loops.
