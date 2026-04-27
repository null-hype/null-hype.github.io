import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import ScaffoldMilestone from '../components/ScaffoldMilestone';
import { grammarAsProtocolScaffold } from '../data/articleScaffoldContent';

const meta = {
	title: 'Article Scaffold/Lead',
	component: ScaffoldMilestone,
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
							<Story />
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof ScaffoldMilestone>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The milestone is not rendered as metadata or a planning object.
 * In the Astro page model it becomes the opening thesis block of the article.
 */
export const GrammarAsProtocol: Story = {
	args: grammarAsProtocolScaffold.milestone,
};
