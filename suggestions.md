# Codebase Improvements

Based on my exploration of the codebase, here are a few suggestions to improve it:

1. **Fix `act()` warnings in React tests**:
   - `GoalsList.test.tsx`: The `createBtn.click()` triggers state updates and needs to be wrapped in `act()` (e.g., using `fireEvent.click()` from `@testing-library/react`). I have already fixed this locally in a patch.
   - `Settings.test.tsx`: When `Settings` components mount, they fetch data and update the state. The `render(<Settings />)` call should be wrapped in `act()` as shown below:
     ```typescript
     await act(async () => { render(<Settings />); });
     ```
     This has also been patched in my local workspace.

2. **Mock `keytar` in tests to prevent D-Bus/keychain errors**:
   - When running tests locally or in CI environments without X11 or a native keychain, `keytar` throws `[Error: Cannot autolaunch D-Bus without X11 $DISPLAY]`.
   - By mocking `keytar` in tests (e.g., in `app/tests/main/ipc.test.ts`), we ensure isolated and reliable test runs. I've added a mock implementation for `keytar`:
     ```typescript
     vi.mock('keytar', () => ({
       default: {
         getPassword: vi.fn().mockResolvedValue(null),
         setPassword: vi.fn().mockResolvedValue(undefined),
         deletePassword: vi.fn().mockResolvedValue(true),
       }
     }));
     ```

3. **Mock network requests in tests to prevent 500/ECONNREFUSED errors**:
   - Tests like `tests/sync/gdocs-poller.test.ts` and `tests/activity/inference.test.ts` attempt to make real network requests (like to Google APIs). Tests must follow the instruction to use `nock` with recorded fixtures or mock the functions/modules internally. Some tests still output network error stacktraces that clutter the test output.

4. **Address `TODO` comments**:
   - The task schema has `status: 'todo' | 'scheduled' | 'in_progress' | 'done' | 'skipped'`. Note that there's nothing immediately wrong here, but `TODO` comments usually indicate incomplete implementations.

5. **Ensure Test Reliability (`npm run test:coverage`)**:
   - While investigating test runs, Vitest coverage is quite good (around 80% lines) for `src/main`, but ensuring there are no test warnings ensures robustness for CI.
