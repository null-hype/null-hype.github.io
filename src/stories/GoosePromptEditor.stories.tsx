import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import GoosePromptEditor from '../components/GoosePromptEditor';
import '../components/GooseMobileClient.css';

const meta = {
	title: 'ACP/Goose Prompt Editor',
	component: GoosePromptEditor,
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta<typeof GoosePromptEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

type PromptEditorHarnessProps = {
	hintMode?: 'mock-goose' | 'off';
	initialValue?: string;
	providerDelayMs?: number;
	providerMode?: 'async-mock' | 'sync-mock';
	testSeedPrompt?: string;
};

function PromptEditorHarness({
	hintMode = 'off',
	initialValue = '',
	providerDelayMs,
	providerMode = 'sync-mock',
	testSeedPrompt,
}: PromptEditorHarnessProps) {
	const [value, setValue] = React.useState(initialValue);
	const [submittedValue, setSubmittedValue] = React.useState('');

	return (
		<section className="goose-mobile-shell" aria-label="Prompt editor harness">
			<GoosePromptEditor
				hintMode={hintMode}
				providerDelayMs={providerDelayMs}
				providerMode={providerMode}
				value={value}
				onChange={setValue}
				onSubmit={() => setSubmittedValue(value.trim())}
			/>
			<output aria-label="Current prompt">{value}</output>
			<output aria-label="Submitted prompt">{submittedValue}</output>
			{testSeedPrompt ? (
				<button
					type="button"
					className="goose-mobile-sr-only"
					aria-label="Seed test prompt"
					onClick={() => setValue(testSeedPrompt)}
				>
					Seed test prompt
				</button>
			) : null}
		</section>
	);
}

async function waitForEditor(canvasElement: HTMLElement) {
	await waitFor(() => {
		const editor = canvasElement.querySelector('[data-editor-ready="true"]');
		expect(editor).toBeTruthy();
	}, { timeout: 15_000 });
}

export const PromptEditorEmpty: Story = {
	render: () => <PromptEditorHarness />,
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await expect(canvas.getByLabelText('Send prompt')).toBeDisabled();
	},
};

export const PromptEditorWithText: Story = {
	render: () => <PromptEditorHarness initialValue="/inspect @workspace" />,
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await expect(canvas.getByLabelText('Current prompt')).toHaveTextContent(
			'/inspect @workspace',
		);
		await expect(canvas.getByLabelText('Send prompt')).toBeEnabled();
	},
};

export const PromptEditorSubmitting: Story = {
	render: () => (
		<PromptEditorHarness testSeedPrompt="Reply with exactly one word: PONG" />
	),
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await userEvent.click(canvas.getByLabelText('Seed test prompt'));
		await waitFor(() => {
			expect(canvas.getByLabelText('Send prompt')).toBeEnabled();
		});
		await userEvent.click(canvas.getByLabelText('Send prompt'));

		await waitFor(() => {
			const submittedPrompt = canvasElement.querySelector('[aria-label="Submitted prompt"]');
			expect(submittedPrompt).toHaveTextContent('Reply with exactly one word: PONG');
		});
	},
};

export const PromptAsyncSuggestions: Story = {
	render: () => (
		<PromptEditorHarness
			hintMode="mock-goose"
			initialValue="summarize @workspace and list risks"
			providerDelayMs={450}
			providerMode="async-mock"
		/>
	),
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await waitFor(() => {
			expect(canvas.getByLabelText('Suggestion provider status')).toHaveTextContent(
				'Mock Goose suggestions ready.',
			);
		});
		await expect(canvas.getByLabelText('Prompt intelligence')).toHaveTextContent(
			'/summarize',
		);
		await expect(canvas.getByLabelText('Prompt intelligence')).toHaveTextContent(
			'@workspace',
		);
	},
};

export const PromptAsyncLoading: Story = {
	render: () => (
		<PromptEditorHarness
			hintMode="mock-goose"
			initialValue="do the thing @smallweb"
			providerDelayMs={60_000}
			providerMode="async-mock"
		/>
	),
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await waitFor(() => {
			expect(canvas.getByLabelText('Suggestion provider status')).toHaveTextContent(
				'Loading Goose suggestions...',
			);
		});
		await expect(canvas.getByLabelText('Prompt intelligence')).toHaveTextContent(
			'Suggestions pending.',
		);
	},
};

export const PromptHintingWalkthrough: Story = {
	render: () => (
		<PromptEditorHarness
			hintMode="mock-goose"
			initialValue="fix it blah blah @linear"
		/>
	),
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await expect(canvas.getByLabelText('Prompt intelligence')).toHaveTextContent(
			'Diagnostic: add a target, context, and expected output.',
		);
		await expect(canvas.getByLabelText('Prompt intelligence')).toHaveTextContent(
			'@linear',
		);
		await userEvent.click(canvas.getByText('@linear'));
		await expect(canvas.getByLabelText('Reference peek')).toHaveTextContent(
			'PLAN-86 frames this as editor production mode',
		);
		await userEvent.click(canvas.getByLabelText('Close reference peek'));
		await waitFor(() => {
			expect(canvas.queryByLabelText('Reference peek')).toBeNull();
		});
		await userEvent.click(canvas.getAllByText('Structure prompt')[0]);

		await waitFor(() => {
			expect(canvas.getByLabelText('Current prompt')).toHaveTextContent(
				'Target: @workspace',
			);
		});
	},
};

export const PromptHintingMobile: Story = {
	parameters: {
		viewport: {
			defaultViewport: 'mobile1',
		},
	},
	render: () => (
		<PromptEditorHarness
			hintMode="mock-goose"
			initialValue="do the thing @smallweb"
		/>
	),
	play: async ({ canvas, canvasElement }) => {
		await waitForEditor(canvasElement);
		await expect(canvas.getByLabelText('Prompt diagnostics')).toHaveTextContent(
			'Add a target, context, and expected output before sending this task.',
		);
		await userEvent.click(canvas.getByText('@smallweb'));
		await expect(canvas.getByLabelText('Reference peek')).toHaveTextContent(
			'Admin bridge route available',
		);
	},
};
