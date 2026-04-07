import { getCollection, type CollectionEntry } from 'astro:content';

import type { TidelaneListSection } from '../components/TidelaneList';
import type { NowPageMeta } from '../components/NowPageView';
import { generateTidelaneNodes } from './tidelane';

export interface NowPageData {
	readonly meta: NowPageMeta;
	readonly sections: readonly TidelaneListSection[];
	readonly isFavorited: boolean;
}

const NOW_PAGE_TIDELANE_SEED = 26;
const EMPTY_PROJECTS_SUMMARY = 'No in-progress projects are currently published.';
const EMPTY_PROJECTS_MESSAGE = 'No active projects are currently published.';

const projectNodes = generateTidelaneNodes(NOW_PAGE_TIDELANE_SEED).filter(
	(node) => node.phase.name === 'full',
);

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(new Date(value));
}

function getProjectIssueCount(
	project: CollectionEntry<'projects'>,
	issueEntries: readonly CollectionEntry<'issues'>[],
) {
	return issueEntries.filter(
		(issue) =>
			issue.data.Project === project.data.Name || issue.data['Project ID'] === project.data.ID,
	).length;
}

function getLastUpdatedLabel(projectEntries: readonly CollectionEntry<'projects'>[]) {
	const timestamps = projectEntries
		.flatMap((project) => [project.data['Latest Update Date'], project.data['Updated At']])
		.map((value) => {
			if (!value) {
				return Number.NaN;
			}

			return Date.parse(value);
		})
		.filter((value) => Number.isFinite(value));

	if (timestamps.length === 0) {
		return formatDate(new Date().toISOString());
	}

	return formatDate(new Date(Math.max(...timestamps)).toISOString());
}

function buildMeta(activeProjects: readonly CollectionEntry<'projects'>[]): NowPageMeta {
	const projectCount = activeProjects.length;
	const projectLabel = projectCount === 1 ? 'project' : 'projects';

	return {
		lastUpdated: getLastUpdatedLabel(activeProjects),
		title: 'tidelands.dev | Projects',
		intro: [],
		footer:
			projectCount > 0
				? `Published project index built from checked-in Astro content collections. Tracking ${projectCount} in-progress ${projectLabel}.`
				: 'Published project index built from checked-in Astro content collections.',
	};
}

function buildSections(
	activeProjects: readonly CollectionEntry<'projects'>[],
	issueEntries: readonly CollectionEntry<'issues'>[],
): readonly TidelaneListSection[] {
	if (activeProjects.length === 0) {
		return [
			{
				id: 'projects',
				title: 'Projects',
				summary: EMPTY_PROJECTS_SUMMARY,
				emptyMessage: EMPTY_PROJECTS_MESSAGE,
				items: [],
			},
		];
	}

	const groupedByInitiative = new Map<string, CollectionEntry<'projects'>[]>();

	for (const project of activeProjects) {
		const initiative = project.data.Initiatives?.trim() || 'Other';

		if (!groupedByInitiative.has(initiative)) {
			groupedByInitiative.set(initiative, []);
		}

		groupedByInitiative.get(initiative)?.push(project);
	}

	return Array.from(groupedByInitiative.entries()).map(([initiative, projects], groupIndex) => ({
		id: `initiative-${groupIndex}`,
		title: initiative,
		summary: `Tracking ${projects.length} project${projects.length === 1 ? '' : 's'} in this initiative.`,
		items: projects.map((project, itemIndex) => {
			const projectIssueCount = getProjectIssueCount(project, issueEntries);
			const nodeIndex = (groupIndex * 3 + itemIndex) % projectNodes.length;
			const node = projectNodes[nodeIndex];

			if (!node) {
				throw new Error(`Missing tidelane node for project index ${nodeIndex}.`);
			}

			return {
				title: project.data.Name,
				body: project.data.Summary || project.data.Description || '',
				references: `Project: ${project.data.ID} / ${project.data.Status}${projectIssueCount > 0 ? ` / ${projectIssueCount} issues` : ''}`,
				href: `/projects/${project.id}`,
				lane: {
					slug: node.slug,
					w3w: node.w3w,
					moon: node.moon,
					phase: node.phase,
				},
			};
		}),
	}));
}

export async function getNowPageDataFromCollections(): Promise<NowPageData> {
	const projectEntries = await getCollection('projects');
	const issueEntries = await getCollection('issues');
	const activeProjects = projectEntries.filter((project) => project.data.Status === 'In Progress');

	return {
		meta: buildMeta(activeProjects),
		sections: buildSections(activeProjects, issueEntries),
		isFavorited: true,
	};
}

export function createUnavailableNowPageData(now = new Date()): NowPageData {
	return {
		meta: {
			lastUpdated: formatDate(now.toISOString()),
			title: 'tidelands.dev | Projects',
			intro: [
				'This page is built from checked-in project and issue CSV snapshots.',
				'The current build does not have a publishable content snapshot available.',
			],
			footer: 'Restore the checked-in project and issue CSV snapshots, then rebuild the Astro site.',
		},
		sections: [
			{
				id: 'projects',
				title: 'Projects',
				summary: EMPTY_PROJECTS_SUMMARY,
				emptyMessage: EMPTY_PROJECTS_MESSAGE,
				items: [],
			},
		],
		isFavorited: false,
	};
}
