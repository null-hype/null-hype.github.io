import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import PullQuote from '../components/PullQuote';
import { pullQuoteContent } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/PullQuote',
	component: PullQuote,
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
} satisfies Meta<typeof PullQuote>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The operational patch: "The sequence does not need to be centrally
 * authored to become geopolitically real." Sits between node 01 and node
 * 02 as the reframing beat.
 */
export const Default: Story = {
	args: pullQuoteContent,
};
