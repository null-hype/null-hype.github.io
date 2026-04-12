import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ArchiveEntry from '../components/ArchiveEntry';
import { archiveEntries } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/ArchiveEntry',
	component: ArchiveEntry,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="editorial-page">
				<main className="editorial-main">
					<section className="editorial-section archive-section">
						<div className="editorial-container archive-section__grid">
							<div className="archive-section__list">
								<Story />
							</div>
						</div>
					</section>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof ArchiveEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default tone — historical precedent that strengthens the argument
 * (Beirut to Grenada, prediction markets).
 */
export const Strengthens: Story = {
	args: archiveEntries[1],
};

/**
 * Restricted tone — warning labels that constrain the argument (Iraq
 * 2003, aluminium tubes). The tone difference is load-bearing: it marks
 * where the essay is required to police itself.
 */
export const Warning: Story = {
	args: archiveEntries[0],
};

/**
 * The full archive list as it appears in the Comparative Baselines
 * section of the dossier.
 */
export const FullArchive: StoryObj = {
	parameters: {
		layout: 'fullscreen',
	},
	render: () => (
		<div className="editorial-page">
			<main className="editorial-main">
				<section className="editorial-section archive-section">
					<div className="editorial-container archive-section__grid">
						<div className="archive-section__intro">
							<h2 className="archive-section__title">Comparative Baselines</h2>
							<p className="archive-section__eyebrow">
								Historical precedent, red-team warning, forecast layer.
							</p>
						</div>
						<div className="archive-section__list">
							{archiveEntries.map((entry) => (
								<ArchiveEntry key={entry.index} {...entry} />
							))}
						</div>
					</div>
				</section>
			</main>
		</div>
	),
};
