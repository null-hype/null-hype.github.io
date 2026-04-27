import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import EpistemicFrame from '../components/EpistemicFrame';
import { epistemicFrameContent } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/EpistemicFrame',
	component: EpistemicFrame,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="editorial-page">
				<main className="editorial-main">
					<section className="editorial-section editorial-section--bordered">
						<div className="editorial-container">
							<Story />
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof EpistemicFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The epistemic contract that opens the dossier. Sets boundary conditions
 * before the argument begins, so the reader knows what is (and is not) being
 * claimed. This is the "frame" in every sense.
 */
export const Default: Story = {
	args: epistemicFrameContent,
};
