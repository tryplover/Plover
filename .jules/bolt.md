## 2025-05-15 - Targeted IPC and Memoized Filtering
**Learning:** React components often perform O(N*M) operations in render loops (like filtering tasks for every goal). Additionally, IPC handlers often return more data than needed, leading to unnecessary serialization overhead.
**Action:** Use `useMemo` to pre-calculate groupings in O(N) time before rendering lists. Implement granular IPC handlers to fetch only the specific data required for a view (e.g., tasks for a specific goal) rather than fetching the entire database table.
