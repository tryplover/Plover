# Feature: Plugin API & Extensibility

> Read [../overview.md](../overview.md) first.

Enable the community to extend Plover with custom data sources, integrations, and automation rules via a secure plugin system.

## Scope

1. **Plugin Manifest**: JSON schema defining plugin identity, version, and required permissions.
2. **Sandbox Environment**: Restricted execution context for plugins to protect user privacy and system stability.
3. **Core Hooks API**:
   - `activity_provider`: Inject new event types into the activity stream.
   - `task_provider`: Sync tasks from 3rd-party tools (e.g., Jira, Trello).
   - `ui_contribution`: Add custom views or widgets to the main window/overlay.
4. **Plugin Management UI**: Interface to browse, install, and manage permissions for plugins.
5. **Event Interceptors**: Plugins can subscribe to and act upon internal events (e.g., `goal.created`).

## Hard Constraints

- **Capability-Based Permissions**: Plugins must explicitly request access to specific APIs (e.g., "network", "activity-read").
- **No Direct DB Access**: Plugins interact with the Store only via typed API proxies.

## Implementation Order

1. Design the Plugin API surface and Manifest schema.
2. Build the Sandbox runner (Electron UtilityProcess).
3. Implement the `activity_provider` and `task_provider` hooks.
4. Create the Plugin Settings UI.
5. Launch a few "Core" plugins (e.g., Simple Slack Poller) to dogfood the API.
