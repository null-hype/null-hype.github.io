import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EditorialAbstract } from '../components/EditorialAbstract';

const meta = {
	title: 'Broadsheet/Editorial Abstract',
	component: EditorialAbstract,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof EditorialAbstract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		content: 'Formal grammars (specifically Pkl as constraint language) serve as universal protocol layers that enable reliable agent-to-agent coordination in high-stakes security research workflows.',
	},
};

export const LongForm: Story = {
	args: {
		title: 'THE THESIS',
		content: 'The architectural freedom of local-first agentic systems is a feature, not a bug. By codifying expertise into grammars, we separate the "hider" from the "finder," creating a mathematical proof of alignment that traditional prompt engineering cannot achieve.',
	},
};
