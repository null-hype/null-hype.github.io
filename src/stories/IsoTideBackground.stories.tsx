import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { IsoTideBackground } from '../components/IsoTideBackground';

const meta = {
	title: 'Broadsheet/Iso-Tide Background',
	component: IsoTideBackground,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof IsoTideBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		density: 13,
		opacity: 0.1,
	},
};

export const HighDensity: Story = {
	args: {
		density: 39,
		opacity: 0.05,
		strokeWidth: 0.3,
	},
};

export const Cobalt: Story = {
	args: {
		density: 7,
		color: 'var(--tidelands-cobalt)',
		opacity: 0.2,
	},
};

export const InContext: Story = {
	render: (args) => (
		<div style={{ position: 'relative', width: '100%', minHeight: '400px', padding: '4rem' }}>
			<IsoTideBackground {...args} />
			<div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto', background: 'white', padding: '2rem', border: '1px solid black' }}>
				<h1 style={{ fontFamily: 'var(--font-meta)', marginTop: 0 }}>Grammar as Protocol</h1>
				<p style={{ fontFamily: 'var(--font-meta)' }}>
					This story demonstrates the background in a layout context. The concentric curves
					create a sense of place and mathematical depth without interfering with legibility.
				</p>
			</div>
		</div>
	),
};
