# RookieDSH

RookieDSH is a **Desktop Runtime Host for DeepSeek Harness**.

It provides a lightweight Electron shell that starts the DeepSeek Harness runtime, waits for its local web UI, and embeds that UI inside the RookieDSH window. The app does not open an external browser.

## Architecture

```text
Electron Main
  ├── Runtime lifecycle and process cleanup
  ├── JSON configuration
  ├── Runtime IPC handlers
  └── Harness BrowserView

Preload IPC
  └── Exposes the typed runtime, configuration and shell APIs

Renderer
  ├── Startup state screen
  └── Lightweight Floating Control Panel

DeepSeek Harness
  └── Embedded at the configured local URL
```

## Startup Flow

1. Electron creates the RookieDSH window.
2. The configuration file is loaded from Electron's user data directory. Missing or invalid configuration is replaced with defaults.
3. When `runtime.autoStart` is enabled, RookieDSH starts the configured DeepSeek Harness command.
4. Runtime stdout and stderr are captured in a bounded in-memory log buffer.
5. RookieDSH waits for the configured Harness URL to respond.
6. The Harness UI is loaded into the embedded BrowserView.

The default runtime URL is `http://localhost:3080`. On Windows, command resolution supports `dsh.cmd`, `dsh.ps1`, and the configured fallback command.

## Runtime Management

The Runtime state machine uses:

```text
STOPPED → STARTING → RUNNING → STOPPING → STOPPED
                         └──────→ FAILED
```

Runtime status, process ID, URL, start time, errors and recent logs are owned by the Electron Main Process. Renderer code accesses them only through Preload IPC.

When RookieDSH closes, it removes embedded views and stops the Harness process tree. The cleanup path includes a synchronous fallback for abrupt process termination.

## Configuration

The configuration file is JSON and is created automatically under Electron's `userData` directory.

Current configuration areas:

- Runtime command, fallback command, port and URL
- Auto-start behavior
- Startup and shutdown timeouts
- Runtime log limits
- Default window size
- Floating Control Panel width

The current Renderer API exposes read-only configuration access through `config.get()`. Editing configuration from the UI is intentionally not implemented yet.

## Current Limitations

- DeepSeek Harness is the only supported Runtime provider.
- The Control Panel currently provides a lightweight configuration placeholder.
- Configuration editing, diagnostics history and persistent Runtime logs are not implemented.
- Agent, Workspace, Runs, database and model-management features are not part of the current product.

## Roadmap

- v0.2 Foundation: configuration layer, Runtime boundary cleanup and legacy page archival.
- Future stages: Control Center and Runtime diagnostics, subject to product confirmation.

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
