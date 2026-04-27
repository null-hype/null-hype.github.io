import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import InlineFigure from '../components/InlineFigure';
import { inlineFigureContent } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/InlineFigure',
	component: InlineFigure,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="editorial-page">
				<main className="editorial-main">
					<div className="editorial-block">
						<div className="editorial-container">
							<Story />
						</div>
					</div>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof InlineFigure>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Plate illustration used right after the epistemic frame. Establishes a
 * visual anchor for the four-node sequence the reader is about to meet.
 */
export const Default: Story = {
	args: inlineFigureContent,
};
