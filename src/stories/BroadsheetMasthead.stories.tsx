import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BroadsheetMasthead } from '../components/BroadsheetMasthead';

const meta = {
	title: 'Broadsheet/Masthead',
	component: BroadsheetMasthead,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetMasthead>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		title: 'TIDELANDS',
		subtitle: 'RESEARCH BROADSHEET // DISPATCH 001',
		glitch: true,
	},
};

export const Static: Story = {
	args: {
		title: 'TIDELANDS',
		subtitle: 'RESEARCH BROADSHEET // DISPATCH 001',
		glitch: false,
	},
};

export const CustomTitle: Story = {
	args: {
		title: 'GRAMMAR AS PROTOCOL',
		subtitle: 'TECHNICAL SPECIFICATION // REV 0.1',
		glitch: true,
	},
};
