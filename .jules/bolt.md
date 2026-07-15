## 2025-07-15 - [Parallel IPC fetching in React components]
**Learning:** React components in this codebase often perform multiple sequential IPC calls (e.g., fetching goals then tasks) in a single 'fetchData' function, leading to unnecessary cumulative latency.
**Action:** Always check for independent IPC calls in 'useEffect' or data-fetching hooks and parallelize them with 'Promise.all' to minimize loading states.
