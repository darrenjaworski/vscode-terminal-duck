# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension that adds a `@duck` chat participant (and `#duck` language-model tool) grounded in the user's real integrated-terminal activity. The extension subscribes to VS Code shell-integration events, keeps a rolling buffer of recent commands with their exit codes and captured output, and feeds that context to Copilot's LLM when the user invokes `@duck` in Copilot Chat.

## Commands

Compiled output goes to `dist/` (loaded at runtime; `src/` is excluded from the packaged `.vsix` via `.vscodeignore`).

- `npm run compile` — `tsc -p .` → `dist/`
- `npm run watch` — tsc watch mode while developing
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` / `npm run lint:fix`
- `npm run format:check` / `npm run format` (Prettier: **tabs** in TS, 2-space in JSON/YAML/MD, single quotes, trailing commas, 100 col)
- `npm test` — `vitest run`. Single file: `npx vitest run src/prompts.test.ts`. Single test: `npx vitest run -t "name substring"`.
- `npm run package` — builds the `.vsix` via `vsce`
- `npm run kitchen-sink` — `format:check && lint && typecheck && test && compile && package`. CI and the release workflow run this; run it locally before tagging.

Debugging: press **F5** in VS Code (uses `.vscode/launch.json`, which runs `npm: compile` as preLaunchTask and launches an Extension Development Host).

## Architecture

Three source modules, all small; read them together before making changes.

- **`src/extension.ts`** wires the extension to three VS Code surfaces from a single `activate()`:
  1. `vscode.chat.createChatParticipant('terminal-duck.duck', ...)` — the `@duck` participant.
  2. `vscode.lm.registerTool('terminal-duck_getRecentCommands', ...)` — the `#duck` language-model tool so other chat participants / Copilot agent-mode can pull the same history.
  3. `vscode.commands.registerCommand('terminal-duck.clearHistory', ...)` — user-facing reset.
- **`ShellHistory`** (inside `extension.ts`) owns the rolling state. It subscribes to `onDidStartTerminalShellExecution`/`onDidEndTerminalShellExecution`, asynchronously drains `execution.read()` into an 8 KB-bounded per-command buffer, and keeps the last 20 commands. History is in-memory only — it resets when the extension reloads.
- **`src/format.ts`** — pure functions (`CapturedExecution`, `formatExecutions`, `stripAnsi`, `clampLimit`). The formatter is **shared** between the chat participant and the LM tool; any change affects both call paths.
- **`src/prompts.ts`** — one system prompt per slash command (`fix`, `rerun`, `explain`) plus a default. `systemPromptFor(command)` is the only export.

Model selection: `vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' })`. If no model is available the participant surfaces a friendly markdown message; it does not fall back to another provider.

### `package.json` manifest is load-bearing

The `contributes` block is the source of truth for:

- the participant id `terminal-duck.duck` and its slash commands (`fix`, `rerun`, `explain`)
- the LM tool id `terminal-duck_getRecentCommands`, its `toolReferenceName` (`duck`, which is what makes `#duck` work in chat), and its input schema (`limit` 1–20)
- the `terminal-duck.clearHistory` command title

When renaming or adding any of these, update both the manifest and the code that references the id.

## Release flow

Tag-driven. `.github/workflows/release.yml` fires on any `v*` push.

1. Bump `"version"` in `package.json`.
2. `npm install --package-lock-only` to sync the lockfile.
3. Update `CHANGELOG.md`: the workflow extracts the section whose header matches `## [x.y.z]`, so the heading must exist and match exactly (date format `YYYY-MM-DD`).
4. Commit as `chore: release x.y.z`.
5. `git tag vx.y.z && git push origin main && git push origin vx.y.z`.

The workflow verifies the tag matches `package.json`, runs `kitchen-sink`, extracts the matching changelog section as release notes, and creates a GitHub Release with the `.vsix` attached. Tags containing `-` (e.g. `v1.1.0-rc.1`) are marked prerelease. **Marketplace publishing is separate and manual** — the workflow only produces a GitHub Release.

## Runtime requirements (affect reproducibility of bugs)

- VS Code `^1.95.0` + GitHub Copilot Chat installed and signed in. The extension uses `vscode.lm`, which routes through Copilot's entitlement.
- Terminal shell integration must be active. If the user's shell is a plain PTY (or VS Code doesn't recognise it), `onDidStartTerminalShellExecution` never fires, the buffer stays empty, and `formatExecutions([])` returns a note telling the user so. There is no other fallback.
