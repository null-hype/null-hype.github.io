import type { TidelaneListItem, TidelaneListSection } from '../components/TidelaneList';
import type { NowPageMeta } from '../components/NowPageView';
import { generateTidelaneNodes, type TidelaneNode } from './tidelane';

const DEFAULT_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';
const NOW_PAGE_TIDELANE_SEED = 26;
const MAX_ACTIVE_ITEMS = 4;
const MAX_COMPLETED_ITEMS = 3;
const MAX_BACKLOG_ITEMS = 4;
const EMPTY_NOW_MESSAGE = 'No started or unstarted issues are currently assigned.';
const EMPTY_DONE_MESSAGE = 'No completed assigned issues were found in the recent slice.';
const EMPTY_BACKLOG_MESSAGE = 'No backlog or triage issues are currently assigned.';

const LINEAR_NOW_QUERY = `
	query AssignedIssuesForNowPage {
		viewer {
			name
			assignedIssues(first: 50, orderBy: updatedAt) {
				nodes {
					identifier
					title
					description
					updatedAt
					completedAt
					dueDate
					priority
					state {
						name
						type
					}
					project {
						name
					}
					team {
						name
					}
					labels(first: 5) {
						nodes {
							name
						}
					}
				}
			}
		}
	}
`;

type LinearIssueStateType =
	| 'backlog'
	| 'unstarted'
	| 'started'
	| 'completed'
	| 'canceled'
	| 'triage';

interface LinearLabel {
	readonly name: string;
}

interface LinearIssue {
	readonly identifier: string;
	readonly title: string;
	readonly description: string | null;
	readonly updatedAt: string;
	readonly completedAt: string | null;
	readonly dueDate: string | null;
	readonly priority: number | null;
	readonly state: {
		readonly name: string;
		readonly type: LinearIssueStateType;
	};
	readonly project: {
		readonly name: string;
	} | null;
	readonly team: {
		readonly name: string;
	};
	readonly labels: {
		readonly nodes: readonly LinearLabel[];
	};
}

interface LinearNowQueryData {
	readonly viewer: {
		readonly name: string;
		readonly assignedIssues: {
			readonly nodes: readonly LinearIssue[];
		};
	};
}

interface GraphqlError {
	readonly message: string;
}

interface GraphqlResponse<TData> {
	readonly data?: TData;
	readonly errors?: readonly GraphqlError[];
}

export interface NowPageData {
	readonly meta: NowPageMeta;
	readonly sections: readonly TidelaneListSection[];
}

const tidelaneNodes = generateTidelaneNodes(NOW_PAGE_TIDELANE_SEED);
let linearNowPageDataPromise: Promise<NowPageData> | undefined;

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(new Date(value));
}

function priorityRank(priority: number | null) {
	if (priority === null || priority === 0) {
		return Number.POSITIVE_INFINITY;
	}

	return priority;
}

function compareByPriorityThenUpdated(left: LinearIssue, right: LinearIssue) {
	const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);

	if (priorityDelta !== 0) {
		return priorityDelta;
	}

	return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function compareByCompletedThenUpdated(left: LinearIssue, right: LinearIssue) {
	const completedDelta =
		Date.parse(right.completedAt ?? right.updatedAt) - Date.parse(left.completedAt ?? left.updatedAt);

	if (completedDelta !== 0) {
		return completedDelta;
	}

	return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
	return count === 1 ? singular : plural;
}

function joinPhrase(values: readonly string[]) {
	if (values.length === 0) {
		return '';
	}

	if (values.length === 1) {
		return values[0] ?? '';
	}

	if (values.length === 2) {
		return `${values[0]} and ${values[1]}`;
	}

	const head = values.slice(0, -1).join(', ');
	const tail = values.at(-1);

	return `${head}, and ${tail}`;
}

function cleanParagraph(value: string) {
	return value
		.replace(/\r/g, '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/^\s*[-*+]\s+/gm, '')
		.replace(/^\s*\d+\.\s+/gm, '')
		.replace(/^>\s?/gm, '')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/_([^_]+)_/g, '$1')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function truncateText(value: string, maxLength: number) {
	if (value.length <= maxLength) {
		return value;
	}

	const slice = value.slice(0, maxLength).trimEnd();
	const safeSlice = slice.replace(/\s+\S*$/, '');

	return `${safeSlice || slice}...`;
}

function summarizeDescription(description: string | null, fallback: string) {
	if (!description) {
		return fallback;
	}

	const cleaned = cleanParagraph(description);
	const paragraphs = cleaned
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
	const ignoredPrefixes = ['assign to:', 'your job:', 'deliverable:'];
	const candidate =
		paragraphs.find(
			(paragraph) =>
				paragraph.length >= 48 &&
				ignoredPrefixes.every((prefix) => !paragraph.toLowerCase().startsWith(prefix)),
		) ?? paragraphs[0];

	if (!candidate) {
		return fallback;
	}

	return truncateText(candidate.replace(/\s+/g, ' '), 220);
}

function summarizeFocus(issues: readonly LinearIssue[]) {
	const focusAreas = Array.from(
		new Set(issues.map((issue) => issue.project?.name ?? issue.team.name).filter(Boolean)),
	).slice(0, 3);

	if (focusAreas.length === 0) {
		return 'This page updates from assigned issue metadata when the set changes and the site is rendered again.';
	}

	return `The current focus is clustered around ${joinPhrase(focusAreas)}. This page updates from assigned issue metadata when the set changes and the site is rendered again.`;
}

function buildReferences(issue: LinearIssue) {
	const parts = [
		`Linear: ${issue.identifier}`,
		issue.project?.name ?? issue.team.name,
		issue.state.name,
	];
	const labelNames = issue.labels.nodes.map((label) => label.name).slice(0, 3);

	if (labelNames.length > 0) {
		parts.push(labelNames.join(', '));
	}

	if (issue.dueDate) {
		parts.push(`Due ${formatDate(issue.dueDate)}`);
	}

	return parts.join(' / ');
}

function projectItemsToPhase(
	items: readonly LinearIssue[],
	phaseName: TidelaneNode['phase']['name'],
): TidelaneListItem[] {
	const phaseNodes = tidelaneNodes.filter((node) => node.phase.name === phaseName);

	if (phaseNodes.length < items.length) {
		throw new Error(`Not enough tidelane nodes for phase "${phaseName}"`);
	}

	return items.map((issue, index) => {
		const node = phaseNodes[index];

		if (!node) {
			throw new Error(`Missing tidelane node at index ${index} for phase "${phaseName}"`);
		}

		return {
			title: issue.title,
			body: summarizeDescription(
				issue.description,
				`${issue.identifier} is currently in ${issue.state.name.toLowerCase()} for ${
					issue.project?.name ?? issue.team.name
				}.`,
			),
			references: buildReferences(issue),
			lane: {
				slug: node.slug,
				w3w: node.w3w,
				moon: node.moon,
				phase: node.phase,
			},
		};
	});
}

function sectionSummary(kind: 'active' | 'completed' | 'backlog', total: number, shown: number) {
	if (kind === 'active') {
		return `Started + unstarted assignments currently in flight. Showing ${shown} of ${total} ${pluralize(total, 'issue')}.`;
	}

	if (kind === 'completed') {
		return `Most recent completed assignments. Showing ${shown} of ${total} ${pluralize(total, 'issue')}.`;
	}

	return `Backlog and triage work parked outside the active lane. Showing ${shown} of ${total} ${pluralize(total, 'issue')}.`;
}

function buildSections(
	activeIssues: readonly LinearIssue[],
	completedIssues: readonly LinearIssue[],
	backlogIssues: readonly LinearIssue[],
) {
	const shownActive = activeIssues.slice(0, MAX_ACTIVE_ITEMS);
	const shownCompleted = completedIssues.slice(0, MAX_COMPLETED_ITEMS);
	const shownBacklog = backlogIssues.slice(0, MAX_BACKLOG_ITEMS);

	return [
		{
			id: 'now',
			title: 'Now',
			summary: sectionSummary('active', activeIssues.length, shownActive.length),
			emptyMessage: EMPTY_NOW_MESSAGE,
			items: projectItemsToPhase(shownActive, 'full'),
		},
		{
			id: 'recently-done',
			title: 'Recently done',
			summary: sectionSummary('completed', completedIssues.length, shownCompleted.length),
			emptyMessage: EMPTY_DONE_MESSAGE,
			items: projectItemsToPhase(shownCompleted, 'waning'),
		},
		{
			id: 'not-now',
			title: 'Not now',
			summary: sectionSummary('backlog', backlogIssues.length, shownBacklog.length),
			emptyMessage: EMPTY_BACKLOG_MESSAGE,
			items: projectItemsToPhase(shownBacklog, 'waxing'),
		},
	] satisfies readonly TidelaneListSection[];
}

function buildMeta(
	viewerName: string,
	issues: readonly LinearIssue[],
	activeIssues: readonly LinearIssue[],
	completedIssues: readonly LinearIssue[],
	backlogIssues: readonly LinearIssue[],
): NowPageMeta {
	const lastUpdated = issues[0]?.updatedAt ?? new Date().toISOString();

	return {
		lastUpdated: formatDate(lastUpdated),
		title: `What ${viewerName} is doing now`,
		intro: [
			`${viewerName}'s assigned work is being pulled directly from Linear. ${activeIssues.length} active ${pluralize(
				activeIssues.length,
				'issue',
			)}, ${completedIssues.length} recently completed, and ${backlogIssues.length} waiting in backlog or triage.`,
			summarizeFocus(activeIssues),
		],
		footer: `This page is a build-time snapshot of assigned Linear issues. If it looks stale, the site likely has not been rebuilt since ${formatDate(
			lastUpdated,
		)}.`,
	};
}

async function postGraphql<TData>(
	apiKey: string,
	query: string,
	endpoint: string,
): Promise<TData> {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: apiKey,
		},
		body: JSON.stringify({ query }),
	});
	const json = (await response.json()) as GraphqlResponse<TData>;

	if (!response.ok || (json.errors?.length ?? 0) > 0 || !json.data) {
		const details = json.errors?.map((error) => error.message).join('; ') ?? 'Unknown error';
		throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`);
	}

	return json.data;
}

async function loadLinearNowPageData(env: ImportMetaEnv): Promise<NowPageData> {
	const apiKey = env.LINEAR_API_KEY;

	if (!apiKey) {
		throw new Error('LINEAR_API_KEY is required to build the now page from Linear.');
	}

	const endpoint = env.LINEAR_GRAPHQL_ENDPOINT ?? DEFAULT_GRAPHQL_ENDPOINT;
	const data = await postGraphql<LinearNowQueryData>(apiKey, LINEAR_NOW_QUERY, endpoint);
	const issues = [...data.viewer.assignedIssues.nodes].sort(
		(left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
	);
	const activeIssues = issues
		.filter((issue) => issue.state.type === 'started' || issue.state.type === 'unstarted')
		.sort(compareByPriorityThenUpdated);
	const completedIssues = issues
		.filter((issue) => issue.state.type === 'completed')
		.sort(compareByCompletedThenUpdated);
	const backlogIssues = issues
		.filter((issue) => issue.state.type === 'backlog' || issue.state.type === 'triage')
		.sort(compareByPriorityThenUpdated);

	return {
		meta: buildMeta(data.viewer.name, issues, activeIssues, completedIssues, backlogIssues),
		sections: buildSections(activeIssues, completedIssues, backlogIssues),
	};
}

export function getLinearNowPageData(env: ImportMetaEnv = import.meta.env) {
	if (!linearNowPageDataPromise) {
		linearNowPageDataPromise = loadLinearNowPageData(env).catch((error) => {
			linearNowPageDataPromise = undefined;
			throw error;
		});
	}

	return linearNowPageDataPromise;
}

export function createUnavailableNowPageData(now = new Date()): NowPageData {
	return {
		meta: {
			lastUpdated: formatDate(now.toISOString()),
			title: 'What I am doing now',
			intro: [
				'This page expects assigned Linear issues to drive its content.',
				'The current build could not reach Linear, so the sections below are placeholders until the next successful render.',
			],
			footer:
				'Restore LINEAR_API_KEY and outbound access to api.linear.app, then refresh or rebuild the Astro page to repopulate it.',
		},
		sections: buildSections([], [], []),
	};
}
