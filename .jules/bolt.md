# Bolt Journal - Critical Learnings Only

## 2025-07-18 - Daily Schedule Slot-checking Optimization
**Learning:** In local-first productivity apps like Plover, the task auto-scheduler (`scheduleTasks`) searches day-by-day for suitable open slots. Doing O(total_events + total_tasks) overlap comparisons in the inner while loop of each day becomes incredibly expensive when the schedule length (horizonDays) or event count grows. Pre-filtering the global calendar events and scheduled tasks down to only those occurring on the specific day currently being evaluated drops the complexity per slot-check down to O(daily_events + daily_tasks).
**Action:** Always pre-filter global timelines or interval datasets to the relevant day's bounds inside the outer loop, before executing nested fine-grained search or slot allocation loops.

## 2025-07-18 - Upfront Pre-calculations and Hot-loop Date Primitives Caching
**Learning:** In high-frequency scheduling or pathfinding hot loops, date parsing/checking and repeated `.getTime()` calls on Date objects introduce substantial runtime overhead. Pre-calculating static day boundaries (`dayStartTime`/`dayEndTime`/`dailyWindowSize`) and pre-filtering static calendars once per day upfront (storing them in a `daysData` array before entering task processing loops) dramatically speeds up lookup performance. Furthermore, caching start and end milliseconds (`startMs`/`endMs`) alongside Date objects on the scheduled tasks map prevents expensive `.getTime()` property accesses inside nested checking loops.
**Action:** Pre-compute interval parameters upfront and avoid calling dynamic methods/accessors like `.getTime()` inside deep recursive or iterative loops by caching values as primitive numbers.
