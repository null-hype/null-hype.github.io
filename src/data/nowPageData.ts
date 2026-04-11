import { getCollection, type CollectionEntry } from 'astro:content';

import type { TidelaneListSection } from '../components/TidelaneList';
import type { NowPageMeta } from '../components/NowPageView';

export interface NowPageData {
	readonly meta: NowPageMeta;
	readonly sections: readonly TidelaneListSection[];
	readonly isFavorited: boolean;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(new Date(value));
}

function cleanUpdateText(text: string) {
	return text.replace(/^[^\n]*\|\s*[^\n]*\n\n/, '').trim();
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
		return '';
	}

	return formatDate(new Date(Math.max(...timestamps)).toISOString());
}

function buildMeta(activeProjects: readonly CollectionEntry<'projects'>[]): NowPageMeta {
	const projectCount = activeProjects.length;
	const projectLabel = projectCount === 1 ? 'project' : 'projects';

	return {
		lastUpdated: getLastUpdatedLabel(activeProjects),
		title: 'Projects',
		intro: [],
		footer: `${projectCount} in-progress ${projectLabel}`,
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
				summary: '0 in-progress projects',
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
		summary: `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
		items: projects.map((project) => {
			const projectIssueCount = getProjectIssueCount(project, issueEntries);
			const updatedAtIso = project.data['Latest Update Date'] || project.data['Updated At'] || '';
			const updatedAt = updatedAtIso ? formatDate(updatedAtIso) : '';

			return {
				title: project.data.Name,
				body: project.data.Summary || project.data.Description || '',
				href: `/projects/${project.id}`,
				projectId: (project.data.ID ?? '').slice(0, 8).toUpperCase(),
				status: project.data.Status || '',
				priority:
					project.data.Priority && project.data.Priority !== 'No priority'
						? project.data.Priority
						: undefined,
				issueCount: projectIssueCount,
				updatedAt,
				updatedAtIso,
				latestUpdate: project.data['Latest Update']
					? cleanUpdateText(project.data['Latest Update'])
					: undefined,
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

export function createUnavailableNowPageData(): NowPageData {
	return {
		meta: {
			lastUpdated: '',
			title: 'Projects',
			intro: [],
			footer: '0 in-progress projects',
		},
		sections: [
			{
				id: 'projects',
				title: 'Projects',
				summary: '0 in-progress projects',
				items: [],
			},
		],
		isFavorited: false,
	};
}
