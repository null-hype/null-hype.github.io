import React, { useEffect, useMemo, useRef, useState } from 'react';
import './GoosePromptEditor.css';
import {
	analyzeGoosePrompt,
	getMockGoosePromptSuggestionResponse,
	getReferenceDetail,
	getReferenceSummary,
	structureGoosePrompt,
	type GoosePromptReference,
	type GoosePromptSuggestionResponse,
} from './goosePromptIntelligence';

type MonacoApi = typeof import('monaco-editor/esm/vs/editor/editor.api');
type MonacoEditor =
	import('monaco-editor/esm/vs/editor/editor.api').editor.IStandaloneCodeEditor;
type MonacoModel = import('monaco-editor/esm/vs/editor/editor.api').editor.ITextModel;

export type GoosePromptEditorProps = {
	ariaLabel?: string;
	disabled?: boolean;
	hintMode?: 'mock-goose' | 'off';
	onChange: (value: string) => void;
	onSubmit: () => void;
	providerDelayMs?: number;
	providerMode?: 'async-mock' | 'sync-mock';
	value: string;
};

const emptySuggestionResponse: GoosePromptSuggestionResponse = {
	diagnostics: [],
	references: [],
	suggestions: [],
};

function normalizeId(value: string) {
	return value.replace(/[^a-zA-Z0-9-]/g, '-');
}

export default function GoosePromptEditor({
	ariaLabel = 'Goose prompt editor',
	disabled = false,
	hintMode = 'off',
	onChange,
	onSubmit,
	providerDelayMs = 350,
	providerMode = 'sync-mock',
	value,
}: GoosePromptEditorProps) {
	const reactId = normalizeId(React.useId());
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<MonacoEditor | null>(null);
	const modelRef = useRef<MonacoModel | null>(null);
	const monacoRef = useRef<MonacoApi | null>(null);
	const valueRef = useRef(value);
	const onChangeRef = useRef(onChange);
	const onSubmitRef = useRef(onSubmit);
	const hintModeRef = useRef(hintMode);
	const [isEditorReady, setIsEditorReady] = useState(false);
	const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
	const [activeReference, setActiveReference] = useState<GoosePromptReference | null>(null);
	const [asyncSuggestionResponse, setAsyncSuggestionResponse] =
		useState<GoosePromptSuggestionResponse | null>(null);
	const analysis = useMemo(() => analyzeGoosePrompt(value), [value]);
	const syncSuggestionResponse = useMemo(
		() =>
			getMockGoosePromptSuggestionResponse({
				cursorOffset: value.length,
				value,
			}),
		[value],
	);
	const suggestionResponse =
		providerMode === 'async-mock'
			? asyncSuggestionResponse ?? emptySuggestionResponse
			: syncSuggestionResponse;

	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onSubmitRef.current = onSubmit;
	}, [onSubmit]);

	useEffect(() => {
		hintModeRef.current = hintMode;
	}, [hintMode]);

	useEffect(() => {
		let isDisposed = false;
		let cleanup = () => undefined;

		void import('./gooseMonaco').then(({
			findGooseReferenceAtPosition,
			getGooseMonaco,
			updateGoosePromptMarkers,
		}) => {
			if (isDisposed || !containerRef.current) {
				return;
			}

			const monaco = getGooseMonaco();
			const model = monaco.editor.createModel(
				valueRef.current,
				'goose-prompt',
				monaco.Uri.parse(`inmemory://goose/${reactId}.goose`),
			);
			const editor = monaco.editor.create(containerRef.current, {
				ariaLabel,
				automaticLayout: true,
				bracketPairColorization: { enabled: false },
				contextmenu: false,
				cursorBlinking: 'smooth',
				fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
				fontSize: 15,
				glyphMargin: hintModeRef.current === 'mock-goose',
				lineDecorationsWidth: hintModeRef.current === 'mock-goose' ? 14 : 0,
				lineNumbers: 'off',
				minimap: { enabled: false },
				model,
				overviewRulerLanes: 0,
				padding: { bottom: 10, top: 10 },
				quickSuggestions: hintModeRef.current === 'mock-goose',
				readOnly: disabled,
				renderLineHighlight: 'none',
				scrollBeyondLastLine: false,
				stickyScroll: { enabled: false },
				suggest: {
					showInlineDetails: true,
				},
				tabSize: 2,
				wordWrap: 'on',
			});
			const changeSubscription = model.onDidChangeContent(() => {
				const nextValue = model.getValue();
				valueRef.current = nextValue;
				onChangeRef.current(nextValue);
				updateGoosePromptMarkers(model, hintModeRef.current);
			});
			const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
				const reference = findGooseReferenceAtPosition(model, event.position);

				if (reference) {
					setActiveReference(reference.reference);
				}
			});
			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
				onSubmitRef.current(),
			);
			editor.addAction({
				id: 'goose.structurePrompt',
				label: 'Goose: Structure Prompt',
				keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS],
				run() {
					const nextValue = structureGoosePrompt(model.getValue());
					model.setValue(nextValue);
				},
			});
			editor.addAction({
				id: 'goose.peekReference',
				label: 'Goose: Peek Reference',
				keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
				run() {
					const reference = findGooseReferenceAtPosition(model, editor.getPosition());

					if (reference) {
						setActiveReference(reference.reference);
					}
				},
			});

			monacoRef.current = monaco;
			modelRef.current = model;
			editorRef.current = editor;
			updateGoosePromptMarkers(model, hintModeRef.current);
			setIsEditorReady(true);
			window.requestAnimationFrame(() => editor.focus());

			cleanup = () => {
				changeSubscription.dispose();
				cursorSubscription.dispose();
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
	}, [ariaLabel, reactId]);

	useEffect(() => {
		const editor = editorRef.current;
		const model = modelRef.current;

		if (!editor || !model || model.getValue() === value) {
			return;
		}

		model.setValue(value);
	}, [value]);

	useEffect(() => {
		editorRef.current?.updateOptions({ readOnly: disabled });
	}, [disabled]);

	useEffect(() => {
		const model = modelRef.current;

		if (!model) {
			return;
		}

		void import('./gooseMonaco').then(({ updateGoosePromptMarkers }) => {
			updateGoosePromptMarkers(model, hintMode);
		});
	}, [hintMode, value]);

	useEffect(() => {
		if (hintMode !== 'mock-goose' || providerMode !== 'async-mock') {
			setAsyncSuggestionResponse(null);
			setIsSuggestionLoading(false);
			return;
		}

		setIsSuggestionLoading(true);
		setAsyncSuggestionResponse(null);

		const timeoutId = window.setTimeout(() => {
			setAsyncSuggestionResponse(
				getMockGoosePromptSuggestionResponse({
					cursorOffset: value.length,
					value,
				}),
			);
			setIsSuggestionLoading(false);
		}, providerDelayMs);

		return () => window.clearTimeout(timeoutId);
	}, [hintMode, providerDelayMs, providerMode, value]);

	const applyStructuredPrompt = () => {
		const nextValue = structureGoosePrompt(value);
		const model = modelRef.current;

		if (model) {
			model.setValue(nextValue);
			return;
		}

		onChange(nextValue);
	};

	const references = suggestionResponse.references;
	const diagnostics = hintMode === 'mock-goose' ? suggestionResponse.diagnostics : [];
	const suggestions = hintMode === 'mock-goose' ? suggestionResponse.suggestions : [];
	const activeReferenceDetail = activeReference ? getReferenceDetail(activeReference) : null;
	const isProviderLoading =
		hintMode === 'mock-goose' && providerMode === 'async-mock' && isSuggestionLoading;

	return (
		<div
			className="goose-prompt-editor"
			data-editor-ready={isEditorReady ? 'true' : 'false'}
			data-hint-mode={hintMode}
			data-provider-mode={providerMode}
		>
			<div className="goose-prompt-editor-workbench">
				<div
					ref={containerRef}
					className="goose-prompt-editor-surface"
					data-testid="goose-prompt-editor-surface"
				/>
				{activeReferenceDetail ? (
					<div
						className="goose-prompt-reference-peek"
						role="group"
						aria-label="Reference peek"
					>
						<div className="goose-prompt-reference-peek-header">
							<p>{activeReferenceDetail.title}</p>
							<button
								type="button"
								aria-label="Close reference peek"
								onClick={() => setActiveReference(null)}
							>
								close
							</button>
						</div>
						<dl>
							<div>
								<dt>Source</dt>
								<dd>{activeReferenceDetail.source}</dd>
							</div>
							<div>
								<dt>Status</dt>
								<dd>{activeReferenceDetail.status}</dd>
							</div>
						</dl>
						<p>{activeReferenceDetail.detail}</p>
					</div>
				) : null}
			</div>
			<div className="goose-prompt-editor-actions">
				{hintMode === 'mock-goose' && analysis.isVague ? (
					<button
						type="button"
						className="goose-prompt-editor-action"
						onClick={applyStructuredPrompt}
					>
						Structure prompt
					</button>
				) : null}
				<button
					type="button"
					className="goose-prompt-editor-send"
					disabled={disabled || !value.trim()}
					aria-label="Send prompt"
					onClick={onSubmit}
				>
					<span aria-hidden="true">send</span>
				</button>
			</div>
			{hintMode === 'mock-goose' && diagnostics.length ? (
				<section className="goose-prompt-diagnostics" aria-label="Prompt diagnostics">
					<div className="goose-prompt-diagnostics-header">
						<p>Diagnostics</p>
						<span>{diagnostics.length}</span>
					</div>
					<ul>
						{diagnostics.map((diagnostic) => (
							<li key={diagnostic.code}>
								<span>{diagnostic.message}</span>
								{diagnostic.quickFixLabel ? (
									<button type="button" onClick={applyStructuredPrompt}>
										{diagnostic.quickFixLabel}
									</button>
								) : null}
							</li>
						))}
					</ul>
				</section>
			) : null}
			{hintMode === 'mock-goose' ? (
				<section className="goose-prompt-hints" aria-label="Prompt intelligence">
					{providerMode === 'async-mock' ? (
						<p
							className="goose-prompt-provider-status"
							data-loading={isProviderLoading ? 'true' : 'false'}
							aria-label="Suggestion provider status"
						>
							{isProviderLoading
								? 'Loading Goose suggestions...'
								: 'Mock Goose suggestions ready.'}
						</p>
					) : null}
					<p>
						{isProviderLoading
							? 'Suggestions pending.'
							: analysis.isVague
							? 'Diagnostic: add a target, context, and expected output.'
							: `Suggestions: ${suggestions.map((suggestion) => suggestion.label).join(', ')}.`}
					</p>
					{references.length ? (
						<ul>
							{references.map((reference) => (
								<li key={reference}>
									<button
										type="button"
										className="goose-prompt-reference-button"
										onClick={() => setActiveReference(reference)}
									>
										@{reference}
									</button>
									: {getReferenceSummary(reference)}
								</li>
							))}
						</ul>
					) : null}
				</section>
			) : null}
		</div>
	);
}
