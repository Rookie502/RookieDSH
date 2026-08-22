# RookieDSH

RookieDSH is a **Local-first Agent Control Plane and Desktop Operations Center** for DeepSeek Harness.

Current release: `v0.5.2` — Runtime Recovery Reliability and Model Resource State Refinement.

RookieDSH starts the DeepSeek Harness runtime, waits for its local web UI, and embeds that UI inside the Electron window. It also provides a lightweight Control Center for runtime visibility, model endpoint registration, workspace metadata and update checks. It does not open an external browser.

## Architecture

```text
Electron Main
  ├── Runtime lifecycle and process cleanup
  ├── Runtime Adapter and DSH native Provider Bridge
  ├── DeepSeek Harness runtime registry
  ├── Model endpoint registry and health checks
  ├── Workspace metadata and bindings
  ├── JSON configuration and persistence
  ├── Update providers and version checks
  └── Harness BrowserView

Preload IPC
  └── Exposes typed runtime, resource, update and shell APIs

Renderer
  ├── Startup state screen
  └── Overlay Control Center

DeepSeek Harness
  └── Embedded at the configured local URL
```

Renderer code does not access the filesystem, network or runtime process directly. Resource and update operations go through Preload IPC to the Electron Main Process.

## Startup Flow

1. Electron creates the RookieDSH window and startup screen.
2. The JSON configuration is loaded from Electron `userData`; missing or invalid configuration is replaced with defaults.
3. When `runtime.autoStart` is enabled, RookieDSH starts the configured DeepSeek Harness command.
4. Runtime stdout and stderr are captured in a bounded in-memory log buffer.
5. RookieDSH reports process, port, HTTP and page readiness separately while waiting for the configured Harness URL.
6. The Harness UI is loaded into the embedded BrowserView.
7. Runtime state is synchronized into the local runtime registry.

The default runtime URL is `http://localhost:3080`. Windows command resolution supports `dsh.cmd`, `dsh.ps1` and the configured fallback command. The normal startup timeout is `runtime.startTimeout` (45 seconds by default); `runtime.startupTimeout` remains accepted as a legacy config alias. Controlled update restarts use `runtime.updateRestartTimeout` (120 seconds by default). The runtime provider does not launch an external browser.

## Runtime Management

The Runtime state machine uses:

```text
STOPPED → STARTING → RUNNING → STOPPING → STOPPED
                         └──────→ FAILED
```

Runtime status, process ID, URL, start time, errors and recent logs are owned by Main Process. The runtime registry stores the DeepSeek Harness identity, detected version, capabilities and native process metadata. Version detection uses the configured CLI and does not perform upgrades.

When RookieDSH closes, it removes embedded views and stops the Harness process tree. Runtime state changes are also projected into the Core event stream.

## Resource Integration

The Models view supports OpenAI-compatible endpoints. It currently supports:

- Add and remove endpoint metadata
- Test connectivity through `GET /v1/models`
- Discover model IDs
- Persist endpoint status, discovered models and the latest error

Endpoint availability and model resource state are kept separate. A successful `/v1/models` response proves that the endpoint is reachable and a model is discovered; it does not claim that the model is loaded. Without an official loaded-model query, models remain `DISCOVERED` and the UI reports that loaded state is unavailable. Offline checks preserve the last known model catalog.

The default form is prepared for the LM Studio endpoint `http://10.18.143.100:1234/v1`, but it is not added automatically. Workspace metadata can bind a registered workspace to a runtime ID and model endpoint ID without deleting or modifying the real workspace directory.

The Models view keeps RookieDSH Model Endpoints separate from DeepSeek Harness native Providers. Provider reads, model catalogs, redacted credential status and model discovery use the DSH local RPC API exposed by the running Harness. Import, Bind and Unbind are explicit actions; startup never overwrites existing DSH settings. A matching native Provider is reused instead of creating a duplicate. Applying a new OpenAI-compatible endpoint uses DSH's `llm-pi-ai` settings namespace and `openai-completions` protocol.

The Runtime view reports capabilities confirmed for the installed DSH version. Default-model selection and ACP are not assumed when no stable public interface is available.

## Update Infrastructure

The Updates view provides check infrastructure for:

- RookieDSH: GitHub Releases for `Rookie502/RookieDSH`
- DeepSeek Harness: installed CLI version and npm registry version

Checks store current version, latest version, release notes, release URL, compatibility status and checked time. RookieDSH itself is never self-updated. For DeepSeek Harness only, the Runtime page can execute a confirmed update through a controlled flow:

```text
Check → confirm → stop runtime → backup package → install → verify → restart
                                      └──────── rollback on failure ────────┘
```

The updater detects npm-global, npx and dsh-command installations. It never changes Workspace metadata, credentials or configuration. Installation and runtime recovery are recorded separately: an installed package whose restart exceeds the update timeout is reported as `SUCCEEDED_RUNTIME_RECOVERY_REQUIRED`, with a manual restart action, rather than as a package-install failure. Update history is stored in `rookiedsh.db`; update preferences (`autoCheck` and `checkFrequency`) are persisted in `config.json`.

## Persistence

The dependency-free JSON document `rookiedsh.db` is stored in Electron `userData`. Schema migrations `002-resources`, `003-update-history`, `004-runtime-bindings`, `005-endpoint-health` and `006-update-outcomes` add:

- `runtimeInstances[]`
- `modelEndpoints[]`
- `softwareVersions[]`
- `updateChecks[]`
- `updateHistory[]`
- `runtimeModelBindings[]` containing only runtime, endpoint, native provider, model and sync metadata
- endpoint freshness, model resource states and update installation/restart outcomes

Existing workspace, task, run and event records are preserved. Deleting workspace metadata only removes the RookieDSH record and never deletes the real directory.

## Control Center

The Control Center is a right-side overlay BrowserView and does not resize the Harness BrowserView. Its views are:

```text
Overview · Runtime · Models · Workspace · Tasks · Updates · Settings
```

It supports Chinese and English with a persisted language preference. The panel width is persisted and bounded to 320–600px, with a default of 420px.

## Secret Handling

RookieDSH never stores DSH API keys in `rookiedsh.db`, `config.json`, diagnostics, events or update history. The DSH API exposes only credential status to reads. If a credential is set through the native bridge, it crosses one Main-process IPC call into DSH's native credential store and is not persisted by RookieDSH. The UI displays only configured/not configured state.

## Current Limitations

- DeepSeek Harness is the only managed runtime provider.
- RookieDSH endpoint health currently uses the OpenAI-compatible `/models` discovery path; custom headers are not implemented.
- DSH native Provider APIs are tied to the installed RC version. Capability probing reports compatibility warnings instead of assuming future DSH versions have the same shape.
- Unbind removes the RookieDSH mapping only; it does not delete a native DSH Provider, preventing accidental removal of user-managed configuration.
- RookieDSH Electron self-update is not implemented. DeepSeek Harness updates require explicit confirmation and do not update the installer.
- npx rollback restores and verifies the previous package archive, but the unpinned npx resolver may reselect a newer package on a later launch; npm-global installs provide the strongest rollback guarantee.
- Workspace binding has Main/Core APIs, while dedicated binding controls are not yet exposed in the Control Center.
- Tasks and Runs remain foundation records and do not execute work.
- Agent orchestration, ACP, Codex adapter, model routing and task execution are not implemented.

## Roadmap

- v0.4: resource registries, runtime version visibility and update-check infrastructure.
- v0.4.1: controlled DeepSeek Harness runtime update execution with backup, verification, rollback and history.
- v0.5.0: DSH native capability audit, Runtime Adapter, Provider Bridge and explicit endpoint binding.
- v0.5.1: live endpoint health freshness, compact resource views and reliable runtime update jobs.
- v0.5.2: separated runtime readiness phases, longer update restart recovery, explicit update outcomes and model resource states.
- Next: observe Provider compatibility across DSH RC updates and harden read/import/bind workflows.
- Later: define additional runtime adapters only after their real native interfaces are verified.

## Development

```powershell
npm install
npm run dev
```

Validation:

```powershell
npm run typecheck
npm run build
```
