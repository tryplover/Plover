# Feature: LAN Sync & Multi-Device Support

> Read [../overview.md](../overview.md) first.

Allow users to synchronize their Plover data across multiple devices (e.g., laptop and desktop) on the same local network without using a central cloud server.

## Scope

1. **Peer Discovery**: Automatic detection of other Plover instances on the LAN (using mDNS/Bonjour).
2. **Encrypted Transport**: Secure, end-to-end encrypted communication between devices.
3. **Delta Synchronization**: Syncing only the changes (goals, tasks, settings) since the last connection.
4. **Conflict Resolution**: Deterministic resolution strategy (e.g., Last-Write-Wins or CRDTs for specific fields).
5. **Multi-Account/Profile Support**: Ability to switch between different productivity contexts.

## Hard Constraints

- **No Public Internet Sync**: Communication is restricted to the local network or direct peer-to-peer connections.
- **Mutual Authentication**: Devices must be explicitly paired (e.g., via QR code or numeric code) before syncing.

## Implementation Order

1. Implement mDNS discovery.
2. Build the encrypted P2P communication channel.
3. Define the sync protocol and delta tracking in SQLite.
4. Add the Pairing UI in Settings.
5. Implement background sync and conflict handling.
