# Feature: Voice Input (Local whisper.cpp)

> Read [../overview.md](../overview.md) first.

This feature enables users to capture goals and tasks using natural voice input. Audio is transcribed locally on the device using `whisper.cpp`, ensuring absolute privacy and low latency.

## Scope

1. **Local Transcription Engine**: Integration of `whisper.cpp` (via `node-whisper` or similar bindings).
2. **Overlay Voice UI**: A push-to-talk (PTT) button or global hotkey trigger for recording.
3. **Audio Capture**: Buffered recording of user speech from the default system microphone.
4. **Transcription Pipeline**: Converting audio buffers to text and feeding them into the existing `decomposeGoal` flow.
5. **Feedback Loop**: Visual indicators for recording state, processing, and transcription preview.

## Hard Constraints

- **Zero Cloud Leakage**: Audio data must never be sent to external APIs for transcription.
- **Resource Efficiency**: The transcription process must not pin the CPU/GPU for extended periods, maintaining system responsiveness.
- **Model Management**: Automatic downloading and caching of optimized Whisper models (e.g., `tiny.en`, `base.en`).

## Implementation Order

1. Integrated `whisper.cpp` native bindings.
2. Implement audio capture module in the main process.
3. Create the Voice UI components in the Overlay.
4. Wire audio capture to transcription to planner.
5. Add model download/selection logic in Settings.
