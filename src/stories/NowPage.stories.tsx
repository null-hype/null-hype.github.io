import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import TidelaneList from '../components/TidelaneList';
import NowPageView from '../components/NowPageView';
import {
	cyberFarmDispatchesSection,
	grammarAsProtocolSection,
	mockNowPageData,
	mockUnavailableNowPageData,
} from '../data/nowPageFixture';

const meta = {
	title: 'Project Landing/Page',
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta;

export default meta;

/**
 * A focused landing-page slice with two real initiative sections from the
 * checked-in project collection. This keeps the page story closer to the
 * actual Astro usage than the previous board/card presentation.
 */
export const LandingSections: StoryObj = {
	render: () => (
		<div
			style={{
				padding: '4rem 2rem',
				background: 'var(--editorial-bg, #fcf9f8)',
				minHeight: '100vh',
			}}
		>
			<TidelaneList sections={[cyberFarmDispatchesSection, grammarAsProtocolSection]} />
		</div>
	),
};

/**
 * The full project landing page as rendered on the Astro site at `/now`.
 * The fixtures mirror the live collection structure, but the surface reads
 * as a continuous editorial index rather than a project board.
 */
export const ActiveProjects: StoryObj = {
	render: () => (
		<NowPageView
			meta={mockNowPageData.meta}
			sections={mockNowPageData.sections}
			isFavorited={true}
		/>
	),
};

/**
 * Empty state — no in-progress projects published. The page still keeps
 * the editorial shell, but the content collapses to a single empty section.
 */
export const EmptyState: StoryObj = {
	render: () => (
		<NowPageView
			meta={{
				...mockNowPageData.meta,
				footer: 'No active projects.',
			}}
			sections={[
				{
					id: 'projects',
					title: 'Projects',
					emptyMessage: 'No active projects are currently published.',
					items: [],
				},
			]}
			isFavorited={true}
		/>
	),
};

/**
 * Unavailable state — the CSV snapshot is missing entirely. Uses the
 * same `createUnavailableNowPageData()` shape the Astro build falls
 * back to when content collections fail to load.
 */
export const UnavailableState: StoryObj = {
	render: () => (
		<NowPageView
			meta={mockUnavailableNowPageData.meta}
			sections={mockUnavailableNowPageData.sections}
			isFavorited={mockUnavailableNowPageData.isFavorited}
		/>
	),
};
