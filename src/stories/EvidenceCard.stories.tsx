import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import EvidenceCard from '../components/EvidenceCard';
import { evidenceCards } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/EvidenceCard',
	component: EvidenceCard,
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
							<div className="evidence-grid">
								<Story />
							</div>
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof EvidenceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Metric variant. A compression statistic — four residences, fourteen
 * months. Numeric anchor for the pattern claim.
 */
export const Metric: Story = {
	args: evidenceCards[0],
};

/**
 * Quote variant. Methodology note reframing the argument from "proven" to
 * "well-formed enough to interrogate."
 */
export const Quote: Story = {
	args: evidenceCards[1],
};

/**
 * Signal variant. The claim ladder: resembles → is read as → can be scored
 * as a signal. The three-bar meter is the visual metaphor.
 */
export const Signal: Story = {
	args: evidenceCards[2],
};

/**
 * The full three-card grid as it appears in the dossier, between node 02
 * and the analyst callout.
 */
export const FullGrid: StoryObj = {
	parameters: {
		layout: 'fullscreen',
	},
	render: () => (
		<div className="editorial-page">
			<main className="editorial-main">
				<section className="editorial-section">
					<div className="editorial-container">
						<div className="evidence-grid">
							{evidenceCards.map((card) => (
								<EvidenceCard key={card.label} {...card} />
							))}
						</div>
					</div>
				</section>
			</main>
		</div>
	),
};
