import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import ArticleScaffoldMap from '../components/ArticleScaffoldMap';
import { grammarAsProtocolScaffold } from '../data/articleScaffoldContent';

const meta = {
	title: 'Article Scaffold/Composed Article',
	component: ArticleScaffoldMap,
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
} satisfies Meta<typeof ArticleScaffoldMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * This is the intended site-facing reading: one article assembled from
 * milestone and issue content, without exposing the Linear planning graph
 * as visible UI metadata.
 */
export const GrammarAsProtocol: Story = {
	args: grammarAsProtocolScaffold,
};
