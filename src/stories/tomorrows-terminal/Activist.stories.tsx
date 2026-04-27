import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import PurpleWorldShell from '../../components/tomorrows-terminal/PurpleWorldShell';
import type {
	OperationalPhase,
	TomorrowTerminalTranscript,
} from '../../components/tomorrows-terminal/types';
import ac03StegoHidingTranscript from '../../fixtures/tomorrows-terminal/ac-03-stego-hiding.transcript.json';

const transcript = ac03StegoHidingTranscript as TomorrowTerminalTranscript;

const meta = {
	title: "Tomorrow's Terminal/The Activist",
	component: PurpleWorldShell,
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta<typeof PurpleWorldShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AC03StegoHiding: Story = {
	args: {
		transcript,
	},
	render: (args, context) => {
		const phase = (context.globals.operationalPhase ?? 'breach') as OperationalPhase;

		return <PurpleWorldShell transcript={args.transcript} phase={phase} />;
	},
	play: async ({ canvas, canvasElement }) => {
		await waitFor(
			() => {
				expect(canvasElement.querySelector('[data-editor-ready="true"]')).toBeTruthy();
			},
			{ timeout: 15_000 },
		);

		await expect(canvas.getByText('AC-03: Stego Hiding')).toBeVisible();
		await expect(canvas.getByText('Anonymity_Score == 100%')).toBeVisible();
		await expect(canvas.getByLabelText('Terminal transcript')).toHaveTextContent(
			'Payload written into least significant pixel bits',
		);
		await waitFor(() => {
			expect(canvasElement.querySelector('[data-zone-widget="carrier-preview"]')).toBeTruthy();
			expect(canvasElement.querySelector('.tt-stego-pixel-inline')).toBeTruthy();
		});
	},
};
