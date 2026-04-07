import type { TidelaneListItem, TidelaneListSection } from '../components/TidelaneList';
import type { NowPageData } from './nowPageData';
import { createUnavailableNowPageData } from './nowPageData';
import { generateTidelaneNodes, type TidelaneNode } from './tidelane';

interface FixtureEntry {
	readonly title: string;
	readonly body: string;
	readonly references: string;
}

const NOW_PAGE_TIDELANE_SEED = 26;
const tidelaneNodes = generateTidelaneNodes(NOW_PAGE_TIDELANE_SEED);

const nowItemsBase: readonly FixtureEntry[] = [
	{
		title: 'Turn the essay into the artifact',
		body:
			'I am composing the Storybook editorial components into the live Astro reading experience and replacing placeholder copy with the v3.5 dossier text from PLAN-26.',
		references: 'Linear: PLAN-163 / jungle.roaring.wave / In Progress',
	},
	{
		title: 'Finish the reusable component layer',
		body:
			'I am keeping the component library coherent enough that this site is not a one-off build. The point is an editorial system that can carry later essays without starting over.',
		references: 'Linear: PLAN-142 / jungle.roaring.wave / In Progress',
	},
	{
		title: 'Make publication boring',
		body:
			'I am lining up the deployment path early so the site can move cleanly from local build to preview and then to the canonical URL without a last-minute packaging scramble.',
		references: 'Linear: PLAN-167 / jungle.roaring.wave / Backlog',
	},
	{
		title: 'Protect the wider editorial platform',
		body:
			'I am keeping one eye on the Falada stress tests and production-pipeline notes, but only enough to preserve momentum. They are supporting work, not permission to drift away from shipping this essay.',
		references: 'Linear: PLAN-18 / Planning / Backlog',
	},
] as const;

const recentlyDoneItemsBase: readonly FixtureEntry[] = [
	{
		title: 'The first full editorial prototype exists',
		body:
			'The Stitch prototype is done. That means the open questions are no longer about vague layout direction. They are now about implementation fidelity, argument quality, and integration.',
		references: 'Linear: PLAN-137 / jungle.roaring.wave / Done',
	},
] as const;

const notNowItemsBase: readonly FixtureEntry[] = [
	{
		title: 'Collecting more parallel projects for their own sake',
		body:
			'I am not trying to turn the site, the backlog, the component library, and the essay into four separate hobbies. The useful job is convergence.',
		references: 'Linear: PLAN-21 / Planning / Backlog',
	},
	{
		title: 'Pretending the argument is already proven',
		body:
			'I am not trying to publish a grand unified theory of hidden coordination. The current standard is smaller and harder: define what would make the pattern stronger, weaker, or obviously overfit.',
		references: 'Linear: PLAN-20 / Planning / Backlog',
	},
] as const;

function projectItemsToPhase(
	items: readonly FixtureEntry[],
	phaseName: TidelaneNode['phase']['name'],
): TidelaneListItem[] {
	const phaseNodes = tidelaneNodes.filter((node) => node.phase.name === phaseName);

	return items.map((item, index) => {
		const node = phaseNodes[index];

		if (!node) {
			throw new Error(`Missing tidelane node at index ${index} for phase "${phaseName}"`);
		}

		return {
			...item,
			lane: {
				slug: node.slug,
				w3w: node.w3w,
				moon: node.moon,
				phase: node.phase,
			},
		};
	});
}

export const mockNowPageData: NowPageData = {
	meta: {
		lastUpdated: 'March 24, 2026',
		title: 'tidelands.dev | Projects',
		intro: [
			'This Storybook fixture mirrors the checked-in project and issue CSV snapshots used by the Astro build.',
			'The useful constraint is that Storybook, Astro, and production all render the same collection-backed shape.',
		],
		footer: 'Published project index built from checked-in Astro content collections.',
	},
	sections: [
		{
			id: 'now',
			title: 'Now',
			summary: 'Started + unstarted assignments currently in flight. Showing 4 of 4 issues.',
			items: projectItemsToPhase(nowItemsBase, 'full'),
		},
		{
			id: 'recently-done',
			title: 'Recently done',
			summary: 'Most recent completed assignments. Showing 1 of 1 issue.',
			items: projectItemsToPhase(recentlyDoneItemsBase, 'waning'),
		},
		{
			id: 'not-now',
			title: 'Not now',
			summary: 'Backlog and triage work parked outside the active lane. Showing 2 of 2 issues.',
			items: projectItemsToPhase(notNowItemsBase, 'waxing'),
		},
	] satisfies readonly TidelaneListSection[],
};

export const mockUnavailableNowPageData = createUnavailableNowPageData(
	new Date('2026-03-25T00:00:00.000Z'),
);
