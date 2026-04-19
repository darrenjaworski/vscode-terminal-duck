export const HIDE_AFTER_MS = 60_000;

export const CHAT_QUERY = '@duck /explain what just went wrong in the terminal?';

export function shouldReact(exitCode: number | undefined): exitCode is number {
	return exitCode !== undefined && exitCode !== 0;
}

export function failureTooltip(commandLine: string, exitCode: number): string {
	const trimmed = commandLine.trim();
	const preview = trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
	return `Last command failed (exit ${exitCode}): ${preview}\nClick to ask @duck.`;
}
