# RookieDSH

RookieDSH is a **Desktop Runtime Host for DeepSeek Harness**.

Current release: `v0.3.3` — Localized Control Center Foundation.

It provides a lightweight Electron shell that starts the DeepSeek Harness runtime, waits for its local web UI, and embeds that UI inside the RookieDSH window. The app does not open an external browser.

## Architecture

```text
Electron Main
  ├── Core services: Workspace / Task / Run / Event
  ├── Local persistence and schema boundary
  ├── Runtime lifecycle and process cleanup
  ├── JSON configuration
  ├── Runtime and Core IPC handlers
  └── Harness BrowserView

Preload IPC
  └── Exposes the typed runtime, configuration and shell APIs

Renderer
  ├── Startup state screen
  └── Lightweight Floating Control Center

DeepSeek Harness
  └── Embedded at the configured local URL
```

RookieDSH owns control-plane records and lifecycle visibility. DeepSeek Harness remains the execution surface and is not rewritten or mirrored into a second transcript store.

The Core boundary is intentionally small:

```text
Renderer → Preload API → Main Core Services → Local Store
                                  └──────→ Runtime Manager
```

## Startup Flow

1. Electron creates the RookieDSH window.
2. The configuration file is loaded from Electron's user data directory. Missing or invalid configuration is replaced with defaults.
3. When `runtime.autoStart` is enabled, RookieDSH starts the configured DeepSeek Harness command.
4. Runtime stdout and stderr are captured in a bounded in-memory log buffer.
5. RookieDSH waits for the configured Harness URL to respond.
6. The Harness UI is loaded into the embedded BrowserView.

The Electron window appears before the Harness is ready and shows the startup state while the runtime is connecting.

The default runtime URL is `http://localhost:3080`. On Windows, command resolution supports `dsh.cmd`, `dsh.ps1`, and the configured fallback command.

## Runtime Management

The Runtime state machine uses:

```text
STOPPED → STARTING → RUNNING → STOPPING → STOPPED
                         └──────→ FAILED
```

Runtime status, process ID, URL, start time, errors and recent logs are owned by the Electron Main Process. Renderer code accesses them only through Preload IPC.

When RookieDSH closes, it removes embedded views and stops the Harness process tree. The cleanup path includes a synchronous fallback for abrupt process termination.

Runtime status changes are also projected into the Core event stream for later operational history.

## Configuration

The configuration file is JSON and is created automatically under Electron's `userData` directory.

Current configuration areas:

- Runtime command, fallback command, port and URL
- Auto-start behavior
- Startup and shutdown timeouts
- Runtime log limits
- Default window size
- Control Center width (default 420px, bounded to 320–600px)
- UI language (`zh-CN` or `en-US`), following the system on first launch

The Renderer accesses configuration only through Preload IPC. The Control Center language switch persists through `config.setLanguage()` and takes effect immediately without restarting the app. Other configuration values remain read-only for now.

## Control Center Views

The Control Center is an overlay BrowserView with lightweight navigation for Overview, Runtime, Models, Workspace, Tasks and Settings. Overview, Runtime, Diagnostics and Configuration use the existing Runtime/Core IPC data. Models, Workspace and Tasks retain intentionally small foundation views; they do not implement Agent orchestration, model routing or task execution.

## Foundation Core

The current Core model contains four durable record types:

- `Workspace`: a registered local directory and its metadata. Deleting it removes only the RookieDSH registration, never the real folder.
- `Task`: a user-owned unit of work associated with a Workspace.
- `Run`: an execution record associated with a Task and a runtime type. Native runtime identifiers are preserved when available.
- `Event`: a normalized control-plane event with source, type, timestamp, payload and optional native ID.

The first persistence implementation is a dependency-free JSON document stored as `rookiedsh.db` in Electron's `userData` directory. It uses a versioned `json-v1` format behind a repository boundary so it can be migrated to SQLite without changing the renderer API.

The Control Center now includes a Core Overview showing Workspace count, active Run count, completed Task count and the latest Event, alongside the existing Runtime, Diagnostics and read-only Configuration cards.

## Current Limitations

- DeepSeek Harness is the only supported Runtime provider.
- The Control Center provides Core Overview, Runtime status, diagnostics and read-only configuration visibility.
- Configuration editing and persistent Runtime log storage are not implemented; diagnostics events are bounded to the recent history kept in `diagnostics.json`.
- Task and Run creation APIs are foundation-only and do not execute work, schedule tasks or automate Agents.
- SQLite migration and schema migrations beyond `json-v1` are not implemented yet.
- Agent orchestration, workspace browsing, task management UI and model management are not part of the current product.

## Roadmap

- v0.2 Foundation: configuration layer, Runtime boundary cleanup, diagnostics and legacy page archival.
- v0.2.1: Runtime Control Center and diagnostics visibility.
- v0.3 Foundation Core: local control-plane models, persistence boundary, Core IPC and Core Overview.
- v0.3.3: localized Control Center, view navigation and platform foundation placeholders.
- Next: define the Runtime adapter contract and event synchronization rules before implementing Agent workflows.

## Development

```powershell
npm install
npm run dev
```

Validation commands:

```powershell
npm run typecheck
npm run build
```
