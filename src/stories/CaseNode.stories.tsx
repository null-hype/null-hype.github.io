import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import CaseNode from '../components/CaseNode';
import { caseNodes } from '../data/editorialContent';

const meta = {
	title: 'Dossier/Components/CaseNode',
	component: CaseNode,
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
} satisfies Meta<typeof CaseNode>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Node 01: Assad falls. The first hard rupture in the four-node sequence.
 * Uses the grid supporting block (Movement / Role In Sequence).
 */
export const Node01_Assad: Story = {
	args: caseNodes[0],
};

/**
 * Node 02: Valdai becomes legible. The weak node — kept only as evidence
 * that public claims about leader vulnerability can matter even when the
 * strike itself is contested.
 */
export const Node02_Valdai: Story = {
	args: caseNodes[1],
};

/**
 * Node 03: Maduro extracted. The vivid demonstration that allied leadership
 * compounds were no longer sacred space. Uses a list supporting block.
 */
export const Node03_Maduro: Story = {
	args: caseNodes[2],
};

/**
 * Node 04: Khamenei struck. The most lethal point in the sequence —
 * irreversible removal at the centre of the Iranian system.
 */
export const Node04_Khamenei: Story = {
	args: caseNodes[3],
};
