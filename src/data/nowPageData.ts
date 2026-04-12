import { getCollection, type CollectionEntry } from 'astro:content';

import type { NowPageMeta } from '../components/NowPageView';
import type { ProjectLandingSectionData } from '../components/ProjectLandingSection';

export interface NowPageData {
	readonly meta: NowPageMeta;
	readonly sections: readonly ProjectLandingSectionData[];
	readonly isFavorited: boolean;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(new Date(value));
}

function stripMarkdown(text: string) {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/^[*-]\s+/gm, '')
		.trim();
}

function firstParagraph(text: string) {
	return stripMarkdown(text)
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)[0] ?? '';
}

function cleanUpdateText(text: string) {
	const withoutHeader = text.replace(/^[^\n]*\|\s*[^\n]*\n\n/, '').trim();
	const firstMeaningfulParagraph =
		withoutHeader
			.split(/\n\s*\n/)
			.map((paragraph) => paragraph.trim())
			.filter(Boolean)
			.find((paragraph) => !/^read the /i.test(stripMarkdown(paragraph))) ?? withoutHeader;

	return stripMarkdown(firstMeaningfulParagraph)
		.replace(/Read the (full )?series\s*→?/gi, '')
		.trim();
}

function cleanProjectBody(project: CollectionEntry<'projects'>) {
	const source = project.data.Summary || project.data.Description || '';
	return firstParagraph(source);
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
): readonly ProjectLandingSectionData[] {
	if (activeProjects.length === 0) {
		return [
			{
				id: 'projects',
				title: 'Projects',
				emptyMessage: 'No active projects are currently published.',
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
				body: cleanProjectBody(project),
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
				emptyMessage: 'The project index is currently unavailable.',
				items: [],
			},
		],
		isFavorited: false,
	};
}
