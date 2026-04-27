import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import AnalystCallout from '../components/AnalystCallout';
import { analystCalloutContent } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/AnalystCallout',
	component: AnalystCallout,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="editorial-page">
				<main className="editorial-main">
					<section className="editorial-section">
						<div className="editorial-container">
							<div className="editorial-case-stack">
								<Story />
							</div>
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof AnalystCallout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Weak-node discipline callout. Placed after the evidence grid so the
 * reader knows that Valdai is kept in the sequence as a lesson, not as
 * equal proof.
 */
export const Default: Story = {
	args: analystCalloutContent,
};

/**
 * Dark tone variant of the same callout, useful on surfaces with more
 * surrounding type.
 */
export const Dark: Story = {
	args: { ...analystCalloutContent, tone: 'dark' },
};
