import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import SectionBreak from '../components/SectionBreak';
import { sectionBreakContent } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/SectionBreak',
	component: SectionBreak,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="editorial-page">
				<main className="editorial-main">
					<div className="editorial-section-break-wrap">
						<div className="editorial-container">
							<Story />
						</div>
					</div>
				</main>
			</div>
		),
	],
} satisfies Meta<typeof SectionBreak>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The "Comparative Tests" pivot. Separates the case sequence from the
 * historical baselines that the argument has to survive.
 */
export const Default: Story = {
	args: sectionBreakContent,
};
