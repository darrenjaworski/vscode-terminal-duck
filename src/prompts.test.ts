import { describe, it, expect } from 'vitest';
import { systemPromptFor } from './prompts';

describe('systemPromptFor', () => {
	it('returns the default prompt when no command is given', () => {
		expect(systemPromptFor(undefined)).toContain('Lead with the most likely cause');
	});

	it('returns the fix-specific prompt for /fix', () => {
		expect(systemPromptFor('fix')).toContain('/fix');
	});

	it('returns the rerun-specific prompt for /rerun', () => {
		expect(systemPromptFor('rerun')).toContain('/rerun');
	});

	it('returns the explain-specific prompt for /explain', () => {
		expect(systemPromptFor('explain')).toContain('/explain');
	});

	it('falls back to the default prompt for unknown commands', () => {
		expect(systemPromptFor('nonsense')).toBe(systemPromptFor(undefined));
	});

	it('always mentions terminal access', () => {
		for (const cmd of [undefined, 'fix', 'rerun', 'explain']) {
			expect(systemPromptFor(cmd)).toContain('integrated terminal');
		}
	});

	it('/fix prompt asks for a specific fix structure', () => {
		const prompt = systemPromptFor('fix');
		expect(prompt).toMatch(/What failed/);
		expect(prompt).toMatch(/Most likely cause/);
		expect(prompt).toMatch(/Fix/);
	});

	it('/rerun prompt asks for a command in a fenced block', () => {
		const prompt = systemPromptFor('rerun');
		expect(prompt).toMatch(/fenced code block/);
		expect(prompt).toMatch(/suggest the next command/i);
	});

	it('/explain prompt focuses on the most recent command', () => {
		const prompt = systemPromptFor('explain');
		expect(prompt).toMatch(/most recent command/);
		expect(prompt).toMatch(/flags/);
	});

	it('each command prompt is distinct from the default', () => {
		const def = systemPromptFor(undefined);
		expect(systemPromptFor('fix')).not.toBe(def);
		expect(systemPromptFor('rerun')).not.toBe(def);
		expect(systemPromptFor('explain')).not.toBe(def);
	});
});
