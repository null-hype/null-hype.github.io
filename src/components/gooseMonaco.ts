import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import 'monaco-editor/min/vs/editor/editor.main.css';
import {
	analyzeGoosePrompt,
	getMockGoosePromptDiagnostics,
	getMockGoosePromptSuggestions,
	getReferenceSummary,
	structureGoosePrompt,
	type GoosePromptReference,
} from './goosePromptIntelligence';

const LANGUAGE_ID = 'goose-prompt';
const MARKER_OWNER = 'goose-prompt';
let didConfigureMonaco = false;

type MonacoWorkerEnvironment = {
	getWorker: (_moduleId: string, _label: string) => Worker;
};

function configureWorkers() {
	(globalThis as typeof globalThis & { MonacoEnvironment?: MonacoWorkerEnvironment })
		.MonacoEnvironment = {
		getWorker() {
			return new EditorWorker();
		},
	};
}

function getCurrentTokenRange(model: monaco.editor.ITextModel, position: monaco.Position) {
	const line = model.getLineContent(position.lineNumber);
	const startColumn = Math.max(
		line.lastIndexOf(' ', position.column - 2) + 2,
		line.lastIndexOf('\n', position.column - 2) + 2,
		1,
	);

	return new monaco.Range(
		position.lineNumber,
		startColumn,
		position.lineNumber,
		position.column,
	);
}

export function findGooseReferenceAtPosition(
	model: monaco.editor.ITextModel,
	position: monaco.Position,
): { range: monaco.Range; reference: GoosePromptReference } | null {
	const line = model.getLineContent(position.lineNumber);
	const pattern = /@(linear|smallweb|workspace)\b/g;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(line)) !== null) {
		const startColumn = match.index + 1;
		const endColumn = startColumn + match[0].length;

		if (position.column >= startColumn && position.column <= endColumn) {
			return {
				range: new monaco.Range(position.lineNumber, startColumn, position.lineNumber, endColumn),
				reference: match[1] as GoosePromptReference,
			};
		}
	}

	return null;
}

function configureLanguage() {
	if (didConfigureMonaco) {
		return;
	}

	didConfigureMonaco = true;
	monaco.languages.register({ id: LANGUAGE_ID });
	monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
		brackets: [
			['(', ')'],
			['[', ']'],
		],
		comments: {
			lineComment: '#',
		},
		wordPattern: /(@?[a-zA-Z][\w-]*|\/[a-zA-Z][\w-]*)/,
	});
	monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
		tokenizer: {
			root: [
				[/@(linear|smallweb|workspace)\b/, 'type.identifier'],
				[/\/(summarize|inspect|fix)\b/, 'keyword'],
				[/(Target|Context|Expected output):/, 'keyword'],
			],
		},
	});

	monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
		triggerCharacters: ['/', '@'],
		provideCompletionItems(model, position) {
			const range = getCurrentTokenRange(model, position);
			const suggestions = getMockGoosePromptSuggestions({
				cursorOffset: model.getOffsetAt(position),
				value: model.getValue(),
			});

			return {
				suggestions: suggestions.map((suggestion) => ({
					label: suggestion.label,
					kind:
						suggestion.kind === 'command'
							? monaco.languages.CompletionItemKind.Function
							: monaco.languages.CompletionItemKind.Reference,
					insertText: suggestion.insertText,
					insertTextRules: suggestion.insertText.includes('${')
						? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
						: undefined,
					detail: suggestion.detail,
					documentation: suggestion.documentation,
					range,
				})),
			};
		},
	});

	monaco.languages.registerInlineCompletionsProvider(LANGUAGE_ID, {
		provideInlineCompletions(model, position) {
			const linePrefix = model
				.getLineContent(position.lineNumber)
				.slice(0, position.column - 1)
				.toLowerCase();

			if (!linePrefix.endsWith('summarize')) {
				return { items: [] };
			}

			return {
				items: [
					{
						insertText: ' @workspace and list risks, tests, and next actions',
						range: new monaco.Range(
							position.lineNumber,
							position.column,
							position.lineNumber,
							position.column,
						),
					},
				],
			};
		},
		disposeInlineCompletions() {
			return undefined;
		},
	});

	monaco.languages.registerHoverProvider(LANGUAGE_ID, {
		provideHover(model, position) {
			const reference = findGooseReferenceAtPosition(model, position);

			if (!reference) {
				return null;
			}

			return {
				range: reference.range,
				contents: [{ value: getReferenceSummary(reference.reference) }],
			};
		},
	});

	monaco.languages.registerCodeActionProvider(
		LANGUAGE_ID,
		{
			provideCodeActions(model) {
				if (!analyzeGoosePrompt(model.getValue()).isVague) {
					return {
						actions: [],
						dispose() {
							return undefined;
						},
					};
				}

				return {
					actions: [
						{
							title: 'Structure as Goose task prompt',
							kind: 'quickfix',
							isPreferred: true,
							edit: {
								edits: [
									{
										resource: model.uri,
										versionId: model.getVersionId(),
										textEdit: {
											range: model.getFullModelRange(),
											text: structureGoosePrompt(model.getValue()),
										},
									},
								],
							},
						},
					],
					dispose() {
						return undefined;
					},
				};
			},
		},
		{
			providedCodeActionKinds: ['quickfix'],
		},
	);
}

export function getGooseMonaco() {
	configureWorkers();
	configureLanguage();
	return monaco;
}

export function updateGoosePromptMarkers(
	model: monaco.editor.ITextModel,
	hintMode: 'mock-goose' | 'off',
) {
	if (hintMode === 'off') {
		monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
		return;
	}

	const diagnostics = getMockGoosePromptDiagnostics(model.getValue());

	if (!diagnostics.length) {
		monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
		return;
	}

	monaco.editor.setModelMarkers(
		model,
		MARKER_OWNER,
		diagnostics.map((diagnostic) => ({
			startLineNumber: 1,
			startColumn: 1,
			endLineNumber: Math.max(1, model.getLineCount()),
			endColumn: Math.max(2, model.getLineMaxColumn(model.getLineCount())),
			severity:
				diagnostic.severity === 'warning'
					? monaco.MarkerSeverity.Warning
					: monaco.MarkerSeverity.Info,
			message: diagnostic.message,
			code: diagnostic.code,
		})),
	);
}
