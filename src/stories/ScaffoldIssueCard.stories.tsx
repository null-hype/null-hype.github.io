import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import ScaffoldIssueCard from '../components/ScaffoldIssueCard';
import { grammarAsProtocolScaffold } from '../data/articleScaffoldContent';

const [thesisIssue, proofIssue] = grammarAsProtocolScaffold.issues;

const meta = {
	title: 'Article Scaffold/Section',
	component: ScaffoldIssueCard,
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
							<div className="scaffold-article__sections">
								<Story />
							</div>
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof ScaffoldIssueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Primary issue rendered as a top-level article section.
 */
export const ThesisIssue: Story = {
	args: thesisIssue,
};

/**
 * Proof issue rendered as a section with nested derived subsections.
 */
export const BlockedProofIssue: Story = {
	args: proofIssue,
};

/**
 * A derived sub-issue rendered as a subsection beat inside the article.
 */
export const DerivedSubIssue: Story = {
	args: proofIssue.subIssues?.[0],
};
