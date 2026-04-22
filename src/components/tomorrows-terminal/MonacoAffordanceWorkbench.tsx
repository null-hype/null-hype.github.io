import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import type * as Monaco from 'monaco-editor';
import type { OperationalPhase, TerminalAffordances } from './types';

type MonacoApi = typeof Monaco;
type MonacoEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoModel = Monaco.editor.ITextModel;
type MonacoPosition = Monaco.Position;

const LANGUAGE_ID = 'tomorrows-terminal';
const MARKER_OWNER = 'tomorrows-terminal';
let didConfigureLanguage = false;

const hoverRegistry = new Map<
	string,
	Pick<TerminalAffordances, 'codeLenses' | 'decorations' | 'hoverTerms'>
>();

function normalizeId(value: string) {
	return value.replace(/[^a-zA-Z0-9-]/g, '-');
}

function positionWithinRange(
	position: MonacoPosition,
	range: {
		endColumn: number;
		endLineNumber: number;
		startColumn: number;
		startLineNumber: number;
	},
) {
	if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) {
		return false;
	}

	if (position.lineNumber === range.startLineNumber && position.column < range.startColumn) {
		return false;
	}

	if (position.lineNumber === range.endLineNumber && position.column > range.endColumn) {
		return false;
	}

	return true;
}

function configureLanguage(monaco: MonacoApi) {
	if (didConfigureLanguage) {
		return;
	}

	didConfigureLanguage = true;
	monaco.languages.register({ id: LANGUAGE_ID });
	monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
		brackets: [
			['[', ']'],
			['{', '}'],
		],
		comments: {
			lineComment: '#',
		},
		wordPattern: /([A-Za-z][\w.-]*|AC-\d+|LSB|DLP|JPEG)/,
	});
	monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
		tokenizer: {
			root: [
				[/(AC-\d+|ClearSight|The Activist|LSB|DLP|JPEG)/, 'keyword'],
				[/(BREACH|PATCH|VERIFY|ASSERTION|DIRECTIVE)/, 'type.identifier'],
				[/CTF\{[^}]+\}/, 'string'],
			],
		},
	});
	monaco.languages.registerHoverProvider(LANGUAGE_ID, {
		provideHover(model, position) {
			const context = hoverRegistry.get(model.uri.toString());

			if (!context) {
				return null;
			}

			const word = model.getWordAtPosition(position)?.word;
			const hoverTerm = context.hoverTerms.find((entry) => entry.term === word);

			if (hoverTerm && word) {
				return {
					contents: [{ value: hoverTerm.markdown }],
					range: new monaco.Range(
						position.lineNumber,
						position.column - word.length,
						position.lineNumber,
						position.column,
					),
				};
			}

			const decoration = context.decorations.find(
				(entry) => entry.hoverMarkdown && positionWithinRange(position, entry),
			);

			if (!decoration?.hoverMarkdown) {
				return null;
			}

			return {
				contents: [{ value: decoration.hoverMarkdown }],
				range: new monaco.Range(
					decoration.startLineNumber,
					decoration.startColumn,
					decoration.endLineNumber,
					decoration.endColumn,
				),
			};
		},
	});
	monaco.languages.registerCodeLensProvider(LANGUAGE_ID, {
		provideCodeLenses(model) {
			const context = hoverRegistry.get(model.uri.toString());

			return {
				lenses: (context?.codeLenses ?? []).map((lens) => ({
					command: {
						id: lens.commandId,
						title: lens.title,
					},
					range: new monaco.Range(lens.lineNumber, 1, lens.lineNumber, 1),
				})),
				dispose() {
					return undefined;
				},
			};
		},
		resolveCodeLens(_model, codeLens) {
			return codeLens;
		},
	});
}

function severityForDiagnostic(monaco: MonacoApi, severity: 'error' | 'info' | 'warning') {
	if (severity === 'error') {
		return monaco.MarkerSeverity.Error;
	}

	if (severity === 'warning') {
		return monaco.MarkerSeverity.Warning;
	}

	return monaco.MarkerSeverity.Info;
}

export default function MonacoAffordanceWorkbench({
	affordances,
	initialValue,
	phase,
}: {
	affordances: TerminalAffordances;
	initialValue: string;
	phase: OperationalPhase;
}) {
	const reactId = normalizeId(React.useId());
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<MonacoEditor | null>(null);
	const modelRef = useRef<MonacoModel | null>(null);
	const monacoRef = useRef<MonacoApi | null>(null);
	const zoneIdsRef = useRef<string[]>([]);
	const decorationIdsRef = useRef<string[]>([]);
	const [isEditorReady, setIsEditorReady] = useState(false);
	const modelUri = useMemo(() => `inmemory://tomorrows-terminal/${reactId}.tt`, [reactId]);

	useEffect(() => {
		let isDisposed = false;
		let cleanup = () => undefined;

		void import('../gooseMonaco').then(({ getGooseMonaco }) => {
			if (isDisposed || !containerRef.current) {
				return;
			}

			const monaco = getGooseMonaco();
			configureLanguage(monaco);

			const model = monaco.editor.createModel(
				initialValue,
				LANGUAGE_ID,
				monaco.Uri.parse(modelUri),
			);
			const editor = monaco.editor.create(containerRef.current, {
				automaticLayout: true,
				contextmenu: false,
				fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
				fontSize: 14,
				glyphMargin: true,
				lineDecorationsWidth: 18,
				lineNumbers: 'on',
				minimap: { enabled: false },
				model,
				padding: { bottom: 16, top: 16 },
				readOnly: true,
				renderLineHighlight: 'line',
				scrollBeyondLastLine: false,
				stickyScroll: { enabled: false },
				wordWrap: 'on',
			});

			monacoRef.current = monaco;
			modelRef.current = model;
			editorRef.current = editor;
			setIsEditorReady(true);

			cleanup = () => {
				hoverRegistry.delete(model.uri.toString());
				monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
				editor.dispose();
				model.dispose();
				editorRef.current = null;
				modelRef.current = null;
				monacoRef.current = null;
			};
		});

		return () => {
			isDisposed = true;
			cleanup();
		};
	}, [initialValue, modelUri]);

	useEffect(() => {
		const editor = editorRef.current;
		const model = modelRef.current;
		const monaco = monacoRef.current;

		if (!editor || !model || !monaco) {
			return;
		}

		hoverRegistry.set(model.uri.toString(), {
			codeLenses: affordances.codeLenses,
			decorations: affordances.decorations,
			hoverTerms: affordances.hoverTerms,
		});
		monaco.editor.setModelMarkers(
			model,
			MARKER_OWNER,
			affordances.diagnostics.map((diagnostic) => ({
				code: diagnostic.code,
				endColumn: diagnostic.endColumn,
				endLineNumber: diagnostic.endLineNumber,
				message: diagnostic.message,
				severity: severityForDiagnostic(monaco, diagnostic.severity),
				startColumn: diagnostic.startColumn,
				startLineNumber: diagnostic.startLineNumber,
			})),
		);

		decorationIdsRef.current = editor.deltaDecorations(
			decorationIdsRef.current,
			affordances.decorations.map((decoration) => ({
				options: {
					className: decoration.className,
					hoverMessage: decoration.hoverMarkdown
						? { value: decoration.hoverMarkdown }
						: undefined,
					inlineClassName: `${decoration.className}-inline`,
					isWholeLine: false,
				},
				range: new monaco.Range(
					decoration.startLineNumber,
					decoration.startColumn,
					decoration.endLineNumber,
					decoration.endColumn,
				),
			})),
		);

		editor.changeViewZones((accessor) => {
			for (const zoneId of zoneIdsRef.current) {
				accessor.removeZone(zoneId);
			}

			zoneIdsRef.current = affordances.zones.map((zone) => {
				const node = document.createElement('section');
				node.className = `tt-zone-widget ${zone.className ?? ''}`.trim();
				node.dataset.zoneWidget = zone.id;
				node.innerHTML = `
					<p class="tt-zone-title">${zone.title}</p>
					<div class="tt-zone-body">${marked.parse(zone.bodyMarkdown) as string}</div>
				`;

				return accessor.addZone({
					afterLineNumber: zone.afterLineNumber,
					domNode: node,
					heightInLines: zone.heightInLines ?? 5,
				});
			});
		});
	}, [affordances, isEditorReady, phase]);

	return (
		<div
			className="tt-monaco-workbench"
			data-editor-ready={isEditorReady ? 'true' : 'false'}
			data-operational-phase={phase}
		>
			<div ref={containerRef} className="tt-monaco-surface" />
		</div>
	);
}
