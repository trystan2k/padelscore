---
name: basic-memory
description: "Use when any agent must operate Basic Memory with an MCP-first approach and automatic CLI fallback for development log creation, updates, and storage with a consistent format."
license: MIT
compatibility: OpenCode
metadata:
  version: "2.0.0"
  owner: agent-skills
---

# Basic Memory MCP-First Development Logging

## When to Use

Use this skill when an agent needs to execute any Basic Memory workflow through Basic Memory MCP first, with Basic Memory CLI fallback only when MCP is unavailable or fails.

MCP scope for this skill:

- Allowed MCP integration: `mcp_basic-memory` only.
- Do not use any other MCP tool while executing this skill.

Typical triggers:
- "create development log"
- "save implementation notes"
- "store task summary in memory"
- "record what changed for this task"
- "update existing development log"
- "check if log exists for task"

## Inputs

Inputs:

- Repository path (do not include it in the log, just the project name).
- Requested action intent (for example: `create`, `update`, `check-existence`, `search`).
- Action parameters (task ID, PRD path, note title, folder path, and flags).
- Task identifier (task ID, subtask ID, or equivalent).
- Implementation context (for create/update actions):
  - objective
  - files changed
  - key decisions
  - validation commands and outcomes
  - known limitations or follow-ups
- Optional metadata:
  - branch
  - commit hash
  - related PR or MR
  - author or agent name
- Safety flags when needed:
  - `allow_install` (boolean)
  - `confirmed` (boolean for destructive actions)

If any required input is missing, stop and return a structured input error.

## Procedure

Procedure:

1. Attempt Basic Memory MCP first (`mcp_basic-memory`) for the requested intent.
2. If MCP succeeds, continue with MCP for execution and verification.
3. If MCP is unavailable or fails (missing tool, unsupported operation, transport error, timeout, permission error, or execution failure), record the failure reason and fallback to CLI.
4. Use 'bm' or 'basic-memory' CLI as a fallback.
5. Set repository context and validate whether the Basic Memory project is configured.
6. Route the intent using the command catalog below.
7. If the exact command is not available in the installed version, use the closest official alias shown in `<bm> --help`.
8. For destructive operations (delete, clear, overwrite, force replace), require `confirmed=true`.
9. Build the log body using the canonical format below (for create/update actions).
10. Ensure all fields are factual and derived from provided implementation context.
11. Execute only Basic Memory CLI commands in fallback mode.
12. Run post-action verification with one read command (`search-notes`, `list`, or equivalent) on the same channel used for execution (MCP or CLI).
13. Return a structured execution report with exact commands/methods, outcomes, and an explicit `Execution Path` note (`MCP` or `CLI fallback`).

MCP invocation requirements:

- Use MCP tool calls (for example, write-note, search-notes, and other methods exposed by `mcp_basic-memory`) for MCP execution.
- Never execute `mcp_basic-memory` in shell (`bash`) as if it were a binary.
- If MCP tooling is unavailable in runtime, report the MCP tool error directly, then proceed with CLI fallback if allowed.

Canonical development log format (required):

```markdown
# Development Log: <task-id>

## Metadata
- Task ID: <task-id>
- Date (UTC): <YYYY-MM-DDTHH:MM:SSZ>
- Project: <project-name>
- Branch: <branch-or-n/a>
- Commit: <commit-hash-or-n/a>

## Objective
- <one-line objective>

## Implementation Summary
- <what was implemented>

## Files Changed
- <path>
- <path>

## Key Decisions
- <decision>

## Validation Performed
- <command>: <pass|fail> - <short result>

## Risks and Follow-ups
- <risk or follow-up>
```

## Outputs

Outputs:

- Markdown report with these sections in this exact order:
  - `Preconditions`
  - `Command Resolution`
  - `Executed Commands`
  - `Result Data`
  - `Validation`
  - `Final Status`

`Final Status` must be one of:

- `success`
- `partial`
- `failed`

### Command Catalog (CLI Reference)

Use these commands as the default reference. Always confirm with `--help` before execution.

Project bootstrap and setup:

- `basic-memory project list`
- `basic-memory project add <name> <path>`
- `basic-memory project default <name>`
- `basic-memory project remove <name>`
- `basic-memory project info`

Note operations:

- `basic-memory tool write-note --title "<title>" --content "<content>" --project <name> --folder "<folder>"`
- `basic-memory tool write-note --title "<title>" --project <name> --folder "<folder>"`
- `basic-memory tool write-note --title "<title>" --tags "tag1" --tags "tag2" --project <name> --folder "<folder>"`
- `basic-memory tool search-notes "<search-term>" --project <name>`

Data import:

- `basic-memory import memory-json /path/to/memory.json`
- `basic-memory --project=<name> import claude conversations`

System status:

- `basic-memory status`
- `basic-memory status --verbose`
- `basic-memory status --json`
- `basic-memory --version`

### Intent-to-Command Routing Hints

Use this mapping when parent agents provide high-level intent:

- `create development log` -> `write-note` with canonical format
- `update existing log` -> `write-note` (Basic Memory handles updates by title)
- `check if log exists` -> `search-notes` by title
- `search logs` -> `search-notes` with search term
- `list all logs` -> `search-notes` or `list` (if available)

### File Naming Convention for Development Logs

**MANDATORY**: Development logs **MUST** be saved with this exact filename format:

```
Task [ID] [Full Task Title From Task Master]
```

**CORRECT Examples:**

- ✅ `Task 1 Implement User Authentication.md`
- ✅ `Task 2 Add Validation Logic.md`
- ✅ `Task 3 Setup Database Schema.md`
- ✅ `Task 70 Strengthen Zod Schema Type Definitions and Export Validation Helpers.md`

## Examples

Input:

- Project: `padelscore`
- Action: `create`
- Task ID: `42`
- Objective: add retry logic for API client
- Files changed: `src/api/client.ts`, `src/api/client.test.ts`
- Validation: `npm test -- client.test.ts` passed

Output:

- `Preconditions`: Basic Memory executable resolved to `basic-memory`; project configured.
- `Command Resolution`: intent `create` mapped to installed version command `<bm> tool write-note`.
- `Executed Commands`: `<bm> tool write-note --title "Task 42 Add Retry Logic for API Client" --content "<log-content>" --project <name> --folder "development-logs"`.
- `Result Data`: development log entry created.
- `Validation`: `<bm> tool search-notes "Task 42 Add Retry Logic" --project <name>` confirms entry exists.
- `Final Status`: `success`.

Input:

- Project: `padelscore`
- Action: `check-existence`
- Task ID: `15`

Output:

- `Preconditions`: Basic Memory executable resolved to `basic-memory`; project configured.
- `Command Resolution`: intent `check-existence` mapped to `<bm> tool search-notes`.
- `Executed Commands`: `<bm> tool search-notes "Task 15" --project <name>`.
- `Result Data`: existing log entry found or not found.
- `Validation`: search results confirm existence state.
- `Final Status`: `success`.

## Notes and Edge Cases

Notes:

- Always attempt MCP first; do not start with CLI unless MCP is unavailable or has already failed for the request.
- Treat requests that require Basic Memory MCP as valid; do not reject solely because MCP is requested.
- Shell errors like `command not found: mcp_basic-memory` indicate incorrect invocation style, not a valid MCP availability check.
- Command names can vary by Basic Memory version; always read `--help` first and adapt.
- Always use the canonical format in this skill.
- Never include secrets, API keys, tokens, or credentials.
- If a write-note command is unavailable in the installed Basic Memory interface, return `failed` with exact command discovery output.
- If persistence succeeds but ID retrieval fails, return `partial` and include verification output.
- **ALWAYS** check if the log already exists before creating a new one. Update if it exists, skip if no changes needed.
- Do not create separate memories for subtasks; include subtask information as part of the parent task log.

## Essential Commands

### Core Workflow Commands

```bash
# Project Management
basic-memory project list                                   # List all configured projects with status
basic-memory project add <name> <path>                      # Create/register a new project
basic-memory project default <name>                         # Set the default project
basic-memory project remove <name>                          # Remove a project (doesn't delete files)
basic-memory project info                                   # Show detailed project statistics

# Note Operations
basic-memory tool write-note --title "Title" --content "Content" --project perfil --folder "folder/path" # Create/update a note
basic-memory tool write-note --title "Title" --project perfil --folder "folder/path"                     # Create note in specific folder
basic-memory tool write-note --title "Title" --tags "tag1" --tags "tag2" --project perfil --folder "folder/path" # Create note with tags
basic-memory tool search-notes "search term"  --project perfil                        # Search notes

basic-memory import memory-json /path/to/memory.json        # Import Memory JSON format
basic-memory --project=work import claude conversations     # Import to specific project

# System Status
basic-memory status                                         # Basic status check
basic-memory status --verbose                               # Detailed status with diagnostics
basic-memory status --json                                  # JSON output format
basic-memory --version                                      # Check installed version
```

### Using stdin with write-note

Basic Memory supports piping content directly to notes:

```bash
# Pipe command output to note
echo "Content here" | basic-memory tool write-note --title "Title" --folder "development-logs" --project perfil

# Pipe file content to note
cat README.md | basic-memory tool write-note --title "Project README" --folder "development-logs" --project perfil

# Using heredoc for multi-line content
cat << EOF | basic-memory tool write-note --title "Meeting Notes" --folder "development-logs" --project perfil
# Meeting Notes

## Action Items
- Item 1
- Item 2
EOF

# Input redirection from file
basic-memory tool write-note --title "Notes" --folder "development-logs" --project perfil < input.md
```
