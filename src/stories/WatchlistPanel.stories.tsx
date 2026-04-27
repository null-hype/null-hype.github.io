import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import WatchlistPanel from '../components/WatchlistPanel';
import { watchlistContent } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/WatchlistPanel',
	component: WatchlistPanel,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="editorial-page">
				<main className="editorial-main">
					<section className="editorial-section">
						<div className="editorial-container" style={{ maxWidth: '32rem' }}>
							<Story />
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof WatchlistPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The forward-tests panel that closes the dossier. Three indicators that
 * would strengthen or weaken the hypothesis if observed — the point where
 * the essay becomes research instead of mood board.
 */
export const Default: Story = {
	args: watchlistContent,
};
