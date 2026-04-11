import type { TidelaneListSection } from '../components/TidelaneList';
import type { NowPageData } from './nowPageData';
import { createUnavailableNowPageData } from './nowPageData';

export const mockNowPageData: NowPageData = {
	meta: {
		lastUpdated: 'March 24, 2026',
		title: 'Projects',
		intro: [],
		footer: '4 in-progress projects',
	},
	sections: [
		{
			id: 'now',
			title: 'Now',
			summary: '4 projects',
			items: [
				{
					title: 'Turn the essay into the artifact',
					body: 'Compose the editorial components into the live Astro reading experience.',
					href: '/projects/plan-163',
					projectId: 'PLAN-163',
					status: 'In Progress',
					issueCount: 4,
					priority: 'High',
					updatedAt: 'March 24, 2026',
					updatedAtIso: '2026-03-24T00:00:00.000Z',
					latestUpdate: 'The page shell and the publishable nodes are aligned.',
				},
			],
		},
	] satisfies readonly TidelaneListSection[],
	isFavorited: true,
};

export const mockUnavailableNowPageData = createUnavailableNowPageData();
