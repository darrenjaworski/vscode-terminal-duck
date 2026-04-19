import { describe, expect, it } from 'vitest';
import { CHAT_QUERY, HIDE_AFTER_MS, failureTooltip, shouldReact } from './failureHint';

describe('shouldReact', () => {
	it('ignores commands that are still running', () => {
		expect(shouldReact(undefined)).toBe(false);
	});

	it('ignores successful exits', () => {
		expect(shouldReact(0)).toBe(false);
	});

	it('reacts to any non-zero exit', () => {
		expect(shouldReact(1)).toBe(true);
		expect(shouldReact(127)).toBe(true);
		expect(shouldReact(139)).toBe(true);
	});

	it('reacts to signal-style negative exits', () => {
		// Some shells report killed processes as negative exit codes.
		expect(shouldReact(-1)).toBe(true);
	});
});

describe('failureTooltip', () => {
	it('includes the command and exit code', () => {
		const tip = failureTooltip('npm test', 1);
		expect(tip).toContain('npm test');
		expect(tip).toContain('exit 1');
	});

	it('keeps commands at the 60-char boundary intact', () => {
		const exactly60 = 'a'.repeat(60);
		const tip = failureTooltip(exactly60, 1);
		expect(tip).toContain(exactly60);
		expect(tip).not.toContain('…');
	});

	it('truncates commands past the 60-char boundary', () => {
		const sixtyOne = 'a'.repeat(61);
		const tip = failureTooltip(sixtyOne, 1);
		expect(tip).toContain('…');
		expect(tip).not.toContain(sixtyOne);
	});

	it('truncates long commands with an ellipsis', () => {
		const long = 'a'.repeat(120);
		const tip = failureTooltip(long, 2);
		const firstLine = tip.split('\n')[0];
		expect(firstLine).toContain('…');
		expect(firstLine.length).toBeLessThan(long.length);
	});

	it('trims surrounding whitespace before truncation', () => {
		const tip = failureTooltip('   echo hi   ', 1);
		expect(tip).toContain('echo hi');
		expect(tip).not.toContain('   echo');
	});

	it('splits command info and click prompt onto separate lines', () => {
		const tip = failureTooltip('false', 1);
		const lines = tip.split('\n');
		expect(lines).toHaveLength(2);
		expect(lines[1]).toContain('Click to ask @duck');
	});
});

describe('CHAT_QUERY', () => {
	it('routes the submission to the @duck participant', () => {
		expect(CHAT_QUERY.startsWith('@duck ')).toBe(true);
	});

	it('invokes the /explain slash command', () => {
		expect(CHAT_QUERY).toContain('/explain');
	});

	it('includes a concrete question so the chat submits instead of idling', () => {
		// Guard against regressing to `@duck /explain ` (no question) which leaves
		// the input waiting for the user to type something.
		const afterExplain = CHAT_QUERY.split('/explain')[1] ?? '';
		expect(afterExplain.trim().length).toBeGreaterThan(0);
	});
});

describe('HIDE_AFTER_MS', () => {
	it('is 60 seconds', () => {
		expect(HIDE_AFTER_MS).toBe(60_000);
	});
});
