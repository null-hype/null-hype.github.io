import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WaterStateGlyph } from '../components/WaterStateGlyphs';

const meta = {
	title: 'Broadsheet/Water State Glyphs',
	component: WaterStateGlyph,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	argTypes: {
		state: {
			control: 'select',
			options: ['pool', 'sea', 'rain'],
		},
		size: {
			control: { type: 'number', min: 16, max: 256, step: 8 },
		},
		color: {
			control: 'color',
		},
	},
} satisfies Meta<typeof WaterStateGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pool: Story = {
	args: {
		state: 'pool',
		size: 64,
	},
};

export const Sea: Story = {
	args: {
		state: 'sea',
		size: 64,
	},
};

export const Rain: Story = {
	args: {
		state: 'rain',
		size: 64,
	},
};

export const LargeTriptych: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
			<WaterStateGlyph state="pool" size={128} />
			<WaterStateGlyph state="sea" size={128} />
			<WaterStateGlyph state="rain" size={128} />
		</div>
	),
};
