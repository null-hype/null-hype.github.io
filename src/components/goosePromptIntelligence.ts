export type GoosePromptReference = 'linear' | 'smallweb' | 'workspace';

export type GoosePromptAnalysis = {
	isVague: boolean;
	references: GoosePromptReference[];
};

export type GoosePromptSuggestionKind = 'command' | 'reference';

export type GoosePromptSuggestion = {
	detail: string;
	documentation: string;
	insertText: string;
	kind: GoosePromptSuggestionKind;
	label: string;
};

export type GoosePromptDiagnostic = {
	code: string;
	message: string;
	quickFixLabel?: string;
	severity: 'info' | 'warning';
};

export type GoosePromptSuggestionRequest = {
	cursorOffset: number;
	sessionId?: string;
	value: string;
};

export type GoosePromptSuggestionResponse = {
	diagnostics: GoosePromptDiagnostic[];
	references: GoosePromptReference[];
	suggestions: GoosePromptSuggestion[];
};

export type GoosePromptReferenceDetail = {
	detail: string;
	source: string;
	status: string;
	title: string;
};

const vaguePromptPattern = /\b(fix it|do the thing|blah blah|make it better|handle this)\b/i;
const referencePattern = /@(linear|smallweb|workspace)\b/g;

export function analyzeGoosePrompt(value: string): GoosePromptAnalysis {
	const references = new Set<GoosePromptReference>();
	let match: RegExpExecArray | null;

	while ((match = referencePattern.exec(value)) !== null) {
		references.add(match[1] as GoosePromptReference);
	}

	return {
		isVague: vaguePromptPattern.test(value.trim()),
		references: [...references],
	};
}

export function structureGoosePrompt(value: string) {
	const original = value.trim() || 'Describe the task.';

	return [
		'Target: @workspace',
		`Context: ${original}`,
		'Expected output: Summarize the change, identify risks, and list the next action.',
	].join('\n');
}

export function getMockGoosePromptDiagnostics(value: string): GoosePromptDiagnostic[] {
	if (!analyzeGoosePrompt(value).isVague) {
		return [];
	}

	return [
		{
			code: 'goose-vague-prompt',
			message: 'Add a target, context, and expected output before sending this task.',
			quickFixLabel: 'Structure prompt',
			severity: 'info',
		},
	];
}

export function getMockGoosePromptSuggestions(
	_request: GoosePromptSuggestionRequest,
): GoosePromptSuggestion[] {
	return [
		{
			label: '/summarize',
			kind: 'command',
			insertText: '/summarize ${1:@workspace} and return ${2:risks and next actions}',
			detail: 'Goose command',
			documentation: 'Ask Goose for a bounded summary with an explicit output shape.',
		},
		{
			label: '/inspect',
			kind: 'command',
			insertText: '/inspect ${1:@workspace} for ${2:regressions}',
			detail: 'Goose command',
			documentation: 'Ask Goose to inspect a target and report findings.',
		},
		{
			label: '/fix',
			kind: 'command',
			insertText: '/fix ${1:@workspace} by ${2:making the smallest safe change}',
			detail: 'Goose command',
			documentation: 'Ask Goose to make a constrained implementation change.',
		},
		{
			label: '@workspace',
			kind: 'reference',
			insertText: '@workspace',
			detail: 'Context reference',
			documentation: getReferenceSummary('workspace'),
		},
		{
			label: '@linear',
			kind: 'reference',
			insertText: '@linear',
			detail: 'Context reference',
			documentation: getReferenceSummary('linear'),
		},
		{
			label: '@smallweb',
			kind: 'reference',
			insertText: '@smallweb',
			detail: 'Context reference',
			documentation: getReferenceSummary('smallweb'),
		},
	];
}

export function getMockGoosePromptSuggestionResponse(
	request: GoosePromptSuggestionRequest,
): GoosePromptSuggestionResponse {
	const analysis = analyzeGoosePrompt(request.value);

	return {
		diagnostics: getMockGoosePromptDiagnostics(request.value),
		references: analysis.references,
		suggestions: getMockGoosePromptSuggestions(request),
	};
}

export function getReferenceSummary(reference: GoosePromptReference) {
	if (reference === 'linear') {
		return 'Linear context: issues, status, labels, and planning trail for the Goose task.';
	}

	if (reference === 'smallweb') {
		return 'Smallweb context: admin session bridge, app routes, and deployment/runtime state.';
	}

	return 'Workspace context: current repository files, stories, build config, and local changes.';
}

export function getReferenceDetail(reference: GoosePromptReference): GoosePromptReferenceDetail {
	if (reference === 'linear') {
		return {
			title: '@linear',
			source: 'Mock connector context',
			status: '3 planning threads available',
			detail:
				'PLAN-86 frames this as editor production mode: diagnostics, hover explanations, quick fixes, and completions. PLAN-81 keeps richer Goose Mobile surfaces on the roadmap without forcing them into this prompt composer slice.',
		};
	}

	if (reference === 'smallweb') {
		return {
			title: '@smallweb',
			source: 'Mock runtime context',
			status: 'Admin bridge route available',
			detail:
				'The Astro client stays static while Smallweb owns the private admin/session bridge. Use this reference when the prompt needs deployment, route, or ACP bridge context.',
		};
	}

	return {
		title: '@workspace',
		source: 'Mock repository context',
		status: 'Current repo selected',
		detail:
			'The workspace reference points Goose at local files, Storybook stories, build config, and uncommitted changes for implementation tasks.',
	};
}
