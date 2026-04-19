# Roadmap

Rough thinking on what could come next for Terminal Duck. This is a sketchpad, not a commitment — items here haven't been promised and may change direction once we start building.

For the longer list of speculative ideas that inspired this extension (most already out of scope), see [IDEAS.md](IDEAS.md).

## 1. Persistent history with opt-in redaction

### Problem

Today `ShellHistory` is in-memory only. Reloading the window (or even just quitting VS Code) wipes every captured command, which is exactly the moment a user would want to ask Duck about "that failure from earlier." The current behaviour is also why `formatExecutions([])` has to apologise when the buffer is empty.

### Shape

- Persist the rolling buffer to `ExtensionContext.workspaceState` (per-workspace) on each `onDidEnd…` event, with a tiny debounce. Restore into `ShellHistory` from `activate()`.
- Keep the 20-command / 8 KB caps — persistence must not turn the buffer into a log.
- Gate persistence behind a setting (`terminalDuck.persistHistory`) defaulting to `true` for workspaceState only. Global state is off the table: cross-project leakage is a footgun.
- Extend `terminal-duck.clearHistory` to also wipe the persisted copy (obvious, but easy to forget).

### Redaction layer (shipped alongside)

Once history survives reload, the "it'll be gone in a minute" mental model breaks. We need a predictable scrub:

- Run captured output through a redactor before it enters the buffer, not before we send to the LLM. (Redacting at the sink means a bug in prompt assembly could leak; redacting at the source can't.)
- First pass: obvious token shapes — `sk-…`, AWS key prefixes, `Bearer …`, `.env`-style `KEY=value` lines, long hex strings that look like secrets. False positives are fine; false negatives are not.
- Setting `terminalDuck.redactSecrets` (default `true`). Setting `terminalDuck.redactPatterns` for user-supplied regexes.
- Redactions leave a `[REDACTED]` marker so the LLM can still reason about structure ("there was a token here") without seeing it.

### Open questions

- Do we persist across VS Code **sessions** (survives quit) or just across **window reloads**? `workspaceState` does the former; the dev feedback cycle might not want it. Probably: yes, persist across sessions — matches user expectation.
- Do we show the user when redaction fires? A subtle status-bar indicator on the first redaction per session could build trust.
- Multi-root workspaces: one buffer or one per root? One shared is simpler and probably fine.

### Non-goals

- Exporting history to disk. If a user wants a transcript, they can copy from chat.
- Searching across persisted history from past workspaces. Out of scope; that's a different product.

## 2. "Ask Duck?" discovery on command failure

### Problem

The extension is only useful if users remember it exists at the moment a command fails. Today there's zero in-situ prompt — the user has to already know to type `@duck` in Copilot Chat. The feature that makes the tool feel native is meeting the user in the terminal at the moment of failure.

### Shape

- Subscribe to `onDidEndTerminalShellExecution` (we already do) and, on non-zero exit, surface an unobtrusive suggestion to open a chat on that failure.
- Two delivery candidates, pick one:
  - **Terminal link provider** — contribute a `vscode.window.registerTerminalLinkProvider` that matches the exit line (or similar) and offers an "Ask @duck" action. Pros: contextually tied to the command. Cons: terminal-link UX is subtle and easy to miss.
  - **Status bar item** — a transient "Duck: last command failed — explain?" entry that appears for ~60s after a failure and routes a click to a pre-filled `@duck /fix` prompt. Pros: hard to miss, easy to ignore. Cons: feels nudgy if overused.
- Route the click through `vscode.commands.executeCommand('workbench.action.chat.open', { query: '@duck /fix' })` (confirm the exact command and arg shape against current VS Code API — this is the kind of thing that shifts between releases).
- Setting `terminalDuck.suggestOnFailure`: `never | subtle | prominent`, default `subtle`.

### Why two delivery candidates

Because the UX tradeoff is the whole feature. Getting it subtly right is more valuable than shipping both. Start with the status bar prototype, live with it for a week, then decide.

### Open questions

- Rate limiting: if a user runs 30 failing commands in a row (`make` in a loop), one status bar nudge is fine; thirty is harassment. Coalesce to at-most-once per minute.
- Do we suggest on `/explain` for successful-but-interesting commands, or only failures? Probably failures-only at first — the signal is clearer.
- Should the suggestion auto-fill the user's most recent failed command into the chat input as a follow-up? That's a small but meaningful UX improvement — worth trying.

### Non-goals

- Auto-opening the chat pane. Never interrupt focus; the user initiates.
- Inline code actions on log files. Nice idea, separate feature, different scope.

## Not on the roadmap (for now)

Kept here so we stop relitigating:

- **User-selectable model.** Current `copilot/gpt-4o` hardcode is fine until someone asks for something else.
- **Test-framework-aware parsers** (jest/vitest/pytest structured failures). Tempting, but a deep rabbit hole per-framework. Revisit if the redaction + failure-discovery work lands cleanly.
- **Multi-terminal scoping** ("only show commands from this terminal"). Adds manifest complexity for a narrow use case; current "recent across all terminals" is usually what you want.
