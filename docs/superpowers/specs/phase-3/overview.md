# Plover — Phase 3 Overview

Phase 3 transitions Plover from a macOS-centric personal assistant into a cross-platform, extensible, and collaborative productivity ecosystem. It introduces local voice intelligence, expands to Windows, and enables multi-device synchronization without compromising its local-first privacy mandate.

The product motivation lives in the [product spec](../2026-05-24-task-tracker-agent-product-spec.md). Phase 1 and Phase 2 architectures remain authoritative for their respective components.

## Phase 3 scope

Phase 3 covers exactly the features below. Each feature has its own subdoc. Implementation order is designed to manage architectural complexity, particularly the platform abstraction and sync v2.

1. **Voice Input (`whisper.cpp`)** — [features/voice-input.md](./features/voice-input.md) (stub)
2. **Windows Port & Platform Abstraction** — [features/windows-port.md](./features/windows-port.md) (stub)
3. **LAN Sync & Multi-Device Support** — [features/lan-sync.md](./features/lan-sync.md) (stub)
4. **Plugin API & Extensibility** — [features/plugins.md](./features/plugins.md) (stub)
5. **Advanced Inference & Nudge Engine v2** — [features/inference-nudge-v2.md](./features/inference-nudge-v2.md) (stub)

**Explicitly out of scope for Phase 3:**
- Mobile applications (iOS/Android).
- Cloud-hosted sync / SaaS backend.
- Multi-user collaborative workspaces (staying focused on individual productivity).

## What changes vs. Phase 2

Phase 3 introduces significant structural changes to support cross-platform parity and extensibility:

- **Platform Abstraction Layer (PAL)**: Refactoring of `main/activity` and `main/sync` to use platform-agnostic interfaces, with concrete implementations for macOS and Windows.
- **Sync v2 (Peer-to-Peer)**: A new `main/sync-v2` module using libp2p or similar for LAN-based discovery and encrypted state synchronization between local devices.
- **Local Inference Expansion**: Integration of `whisper.cpp` for local, high-fidelity transcription, reducing reliance on external APIs for basic input.
- **Plugin Sandbox**: A secure execution environment (likely using `WebWorker` or a restricted Electron `UtilityProcess`) for third-party integrations.

## Hard constraints (Phase 3 deltas)

1. **Local-first Peer Sync** — Synchronization must happen over local networks (LAN) or via manual export/import. No central cloud storage of user data is permitted.
2. **Binary Portability** — Native dependencies (`whisper.cpp`, `better-sqlite3`) must be reliably bundled and executable on both macOS (Silicon/Intel) and Windows (x64).
3. **Permission Parity** — Implement Windows-specific equivalents for macOS TCC (Transparency, Consent, and Control) prompts for Screen Recording and Accessibility.
4. **Accessibility (Keystroke Counting)** — Phase 3 introduces keystroke counting for richer activity signals. Constraint: **never capture content**, only frequency and per-app volume.

## Module map (additions)

```
app/src/main/
  voice/
    whisper-client.ts         # NEW — Local transcription engine
  platform/                   # NEW — Platform Abstraction Layer
    pal-interface.ts
    macos-impl.ts
    windows-impl.ts
  sync-v2/                    # NEW — LAN Peer-to-Peer sync
    peer-discovery.ts
    delta-sync.ts
  plugins/                    # NEW — Plugin host and sandbox
    plugin-manager.ts
    sandbox-runner.ts
  nudge/                      # EXTENDED — Live LLM-driven nudges
    judgment-engine.ts
```

## Data model (additions)

```sql
-- New repo: peers
CREATE TABLE peers (
  id TEXT PRIMARY KEY,
  hostname TEXT,
  last_seen_at TEXT,
  public_key TEXT
);

-- New repo: plugins
CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  permissions TEXT,           -- JSON array of requested scopes
  config TEXT                 -- JSON blob
);
```

## Implementation order

1. **Voice Input.** Add `whisper.cpp` and the voice capture UI. This is a self-contained feature that delivers high user value early.
2. **Platform Abstraction & Windows Port.** Establish the PAL and get the core app (Store, Planner, Sync) running on Windows.
3. **LAN Sync.** Implement peer discovery and basic state sync for Goals/Tasks.
4. **Plugin API.** Define the interface for 3rd-party data producers and consumers.
5. **Advanced Inference & Nudge Engine.** Use the full breadth of activity and plugin data to drive proactive agent behavior.

## Cross-cutting acceptance criteria

1. The application remains fully functional offline (excluding Gemini/Google API features).
2. Voice transcription happens entirely on-device with zero network latency or data leakage.
3. Feature parity between macOS and Windows is maintained for all core subsystems.
4. Plugin execution cannot access the filesystem or network without explicit, granular user permission.
