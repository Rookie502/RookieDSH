# RookieDSH Platform Architecture & Development Roadmap

## 1. Product Positioning

RookieDSH is not a new Agent Runtime and not a model gateway.

Long-term positioning:

> Local-first Agent Control Plane + Desktop Operations Center

Core responsibility:

-   manage Tasks
-   manage Runs
-   manage Workspaces
-   manage Runtime connections
-   manage Model Endpoints
-   manage Policies and Approvals
-   provide Diagnostics and Recovery

Execution remains owned by external runtimes:

-   DeepSeek Harness
-   Codex App Server
-   Future Agent Runtime

------------------------------------------------------------------------

# 2. Final Architecture

    Human
      |
    RookieDSH UI / Tray / Local API
      |
    RookieDSH Core
      |
      +-- Task Manager
      +-- Run Manager
      +-- Workspace Registry
      +-- Runtime Registry
      +-- Model Endpoint Registry
      +-- Policy Engine
      +-- Event Projection
      +-- Diagnostics
      |
    Runtime Adapter Layer
      |
      +-- DeepSeek Harness ACP
      +-- Codex App Server
      +-- Future Runtime
      |
    Models
      |
      +-- Local LM Studio
      +-- LAN LM Studio
      +-- Cloud API
      +-- Gateway

------------------------------------------------------------------------

# 3. Core Design Principles

## 3.1 Runtime is execution truth

DeepSeek Harness and Codex own:

-   sessions
-   history
-   events
-   native execution state
-   model-specific details

RookieDSH stores:

-   references
-   lifecycle state
-   task mapping
-   audit information
-   recovery metadata

Do not duplicate runtime internals.

------------------------------------------------------------------------

## 3.2 Task/Run/Session/Workspace separation

### Workspace

A project environment.

Example:

    RookieDSH workspace
    C:\Code\RookieDSH

Owner:

RookieDSH metadata + Runtime validation

------------------------------------------------------------------------

### Task

User objective.

Example:

    Implement Model Endpoint Registry

Owner:

RookieDSH

------------------------------------------------------------------------

### Run

One execution attempt.

Example:

    Run #2026-001
    Supervisor: Codex Luna
    Worker: DeepSeek Harness

Owner:

RookieDSH

------------------------------------------------------------------------

### Session

Runtime-owned conversation context.

Examples:

-   DeepSeek session
-   Codex Thread

Owner:

Runtime

------------------------------------------------------------------------

# 4. Agent Collaboration Model

Avoid:

    GPT -> DSH -> Codex -> Qwen

Direct agent chatting becomes impossible to audit.

Use:

    Planner
     |
    Plan
     |
    RookieDSH Run
     |
    Supervisor
     |
    Task
     |
    Worker Runtime
     |
    Result
     |
    Audit
     |
    Supervisor Decision

Example:

1.  GPT Architect creates plan.
2.  RookieDSH stores plan.
3.  Codex Luna reviews and creates tasks.
4.  DeepSeek Harness executes tasks.
5.  RookieDSH stores audit.
6.  Luna decides continue or retry.

------------------------------------------------------------------------

# 5. Runtime Integration

## DeepSeek Harness

Human path:

    BrowserView
     |
    Harness UI

Automation path:

    RookieDSH Core
     |
    ACP / SDK
     |
    DeepSeek Harness

Do not use:

-   DOM automation
-   browser control
-   terminal typing simulation

## Codex

Preferred:

    RookieDSH
     |
    Codex App Server
     |
    Thread / Turn / Item

Do not control Codex through fake terminal input.

------------------------------------------------------------------------

# 6. Model Endpoint Architecture

Runtime and Model are separate.

Example:

    Codex Runtime
          |
          +-- GPT-5.6 Luna

    DeepSeek Runtime
          |
          +-- Qwen Local

Model Endpoint:

    Endpoint
     |
     +-- local
     +-- LAN
     +-- cloud
     +-- gateway

Examples:

    127.0.0.1:1234
    LAN LM Studio
    OpenAI API
    Route Gateway

------------------------------------------------------------------------

# 7. Persistence Design

Initial:

    AppData/Roaming/rookiedsh/

    runs/
      id/
        plan.md
        tasks/
        audits/

Future:

    rookiedsh.sqlite

    Tables:

    Workspace
    Task
    Run
    RuntimeSessionRef
    ModelEndpoint
    Approval
    Event
    Diagnostics

------------------------------------------------------------------------

# 8. Control API

UI should not own logic.

Future:

    POST /runs
    GET /runs/:id

    POST /tasks

    POST /dispatch

    POST /cancel

    GET /events

Architecture:

    Electron UI
    Codex Adapter
    DSH Adapter
    MCP Client

          |
          v

    RookieDSH Core API

------------------------------------------------------------------------

# 9. Autonomy Policy

Human remains highest authority.

Levels:

## Level 0

Every action asks.

## Level 1

Code modification automatic.

## Level 2

Worker execution automatic.

## Level 3

Supervisor retries automatically.

## Level 4

Full autonomous Run.

Requires final approval.

Example:

    Allow:
    - edit files
    - run tests

    Ask:
    - delete files
    - git commit
    - deployment

------------------------------------------------------------------------

# 10. Development Roadmap

## Phase 0 Completed

Desktop Shell

Status:

DONE

Features:

-   Electron shell
-   Harness BrowserView
-   Runtime lifecycle
-   Floating Control Center

------------------------------------------------------------------------

# Phase 1 Platform Foundation

Goal:

Create RookieDSH Core.

Implement:

-   SQLite/local store
-   Task model
-   Run model
-   Workspace model
-   Runtime registry
-   Event model

Do not implement Agent automation yet.

------------------------------------------------------------------------

# Phase 2 DeepSeek Adapter

Goal:

First real autonomous execution.

Implement:

-   ACP connection
-   create session
-   send task
-   receive events
-   cancel
-   audit generation

Acceptance:

A Task can be completed without opening Harness UI.

------------------------------------------------------------------------

# Phase 3 Codex Supervisor

Goal:

Introduce Luna supervisor.

Implement:

-   Codex App Server adapter
-   Thread mapping
-   Turn monitoring
-   Approval handling

Flow:

    Luna
     |
    Task
     |
    DSH Worker
     |
    Audit
     |
    Luna

------------------------------------------------------------------------

# Phase 4 Model Platform

Implement:

-   ModelEndpoint registry
-   LM Studio local
-   LAN models
-   Cloud providers
-   Health checks

------------------------------------------------------------------------

# Phase 5 Operations Center

Implement:

-   Run dashboard
-   History
-   Diagnostics
-   Approval center
-   Tray background mode

------------------------------------------------------------------------

# Phase 6 Advanced Agent Platform

Future:

-   multi-worker
-   routing policy
-   MCP integration
-   remote runtime
-   scheduler
-   team mode

------------------------------------------------------------------------

# 11. Rules For Future Development

Never:

-   replace runtime history
-   merge runtime and model
-   control agents through UI automation
-   store API secrets directly
-   make Electron window the runtime owner

Always:

-   preserve native runtime IDs
-   use adapters
-   keep event audit
-   support recovery
-   separate UI from Core

------------------------------------------------------------------------

# Final Vision

RookieDSH becomes:

> A local-first operating system for AI development agents.

Example:

User:

"Complete RookieDSH v0.5"

System:

    GPT:
    Create architecture plan

    Codex Luna:
    Review and split tasks

    DeepSeek + Qwen:
    Implement code

    RookieDSH:
    Track state, approvals, audits

    User:
    Approve final commit

The final product is not another chatbot.

It is an Agent Operations Center.
