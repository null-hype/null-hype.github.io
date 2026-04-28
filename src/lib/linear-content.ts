type JsonObject = Record<string, unknown>;

type LinearCustomViewNode = {
	id: string;
	name: string;
	modelName: string;
	projectFilterData: JsonObject | null;
};

type LinearFavoriteNode = {
	title: string;
	type: string;
	customView: LinearCustomViewNode | null;
};

type LinearProjectNode = {
	id: string;
	name: string;
	description: string | null;
	health: string | null;
	priorityLabel: string | null;
	updatedAt: string;
	status: {
		name: string;
		type: string;
	} | null;
	initiatives: {
		nodes: Array<{
			id: string;
			name: string;
		}>;
	};
	lastUpdate: {
		body: string | null;
		updatedAt: string;
	} | null;
};

type LinearIssueNode = {
	id: string;
	identifier: string;
	title: string;
	description: string | null;
	priorityLabel: string | null;
	createdAt: string;
	updatedAt: string;
	state: {
		name: string;
		type: string;
	} | null;
	assignee: {
		name: string;
	} | null;
	project: {
		id: string;
		name: string;
	} | null;
	inverseRelations: {
		nodes: Array<{
			type: string;
			issue: {
				identifier: string;
			} | null;
		}>;
	};
};

export interface PublicProjectSelector {
	readonly viewId: string;
	readonly viewName: string;
	readonly statusIds: readonly string[];
	readonly healthValues: readonly string[];
	readonly rawFilter: JsonObject;
}

export interface PublicProjectDiagnostics {
	readonly inProgressCount: number;
	readonly latestProjectName: string | null;
	readonly latestProjectUpdatedAt: string | null;
	readonly warning: string;
}

function readEnv(name: string) {
	if (typeof process !== 'undefined' && process.env && name in process.env) {
		return process.env[name];
	}

	if (
		typeof import.meta !== 'undefined' &&
		import.meta.env &&
		typeof import.meta.env === 'object' &&
		name in import.meta.env
	) {
		return String((import.meta.env as Record<string, unknown>)[name] ?? '');
	}

	return undefined;
}

const GRAPHQL_ENDPOINT = readEnv('LINEAR_GRAPHQL_ENDPOINT') ?? 'https://api.linear.app/graphql';
const DEFAULT_PUBLIC_PROJECT_VIEW_ID =
	readEnv('LINEAR_PUBLIC_PROJECT_VIEW_ID') ?? '4eb32a9b-39cf-4e0d-9c56-7888ea12bd76';
const DEFAULT_PUBLIC_PROJECT_VIEW_NAME =
	readEnv('LINEAR_PUBLIC_PROJECT_VIEW_NAME') ?? 'www';
const PLANNING_TEAM_NAME = 'Planning';
const PLANNING_TEAM_KEY = 'PLAN';
const PROJECT_BATCH_SIZE = 50;

const PUBLIC_FAVORITES_QUERY = `
	query PublicFavorites {
		favorites(first: 50) {
			nodes {
				title
				type
				customView {
					id
					name
					modelName
					projectFilterData
				}
			}
		}
	}
`;

const PUBLIC_PROJECTS_QUERY = `
	query PublicProjects($filter: ProjectFilter!, $first: Int!) {
		projects(filter: $filter, first: $first) {
			nodes {
				id
				name
				description
				health
				priorityLabel
				updatedAt
				status {
					name
					type
				}
				initiatives(first: 20) {
					nodes {
						id
						name
					}
				}
				lastUpdate {
					body
					updatedAt
				}
			}
		}
	}
`;

const PUBLIC_ISSUES_QUERY = `
	query PublicIssues($filter: IssueFilter!, $first: Int!) {
		issues(filter: $filter, first: $first) {
			nodes {
				id
				identifier
				title
				description
				priorityLabel
				createdAt
				updatedAt
				state {
					name
					type
				}
				assignee {
					name
				}
				project {
					id
					name
				}
				inverseRelations(first: 50) {
					nodes {
						type
						issue {
							identifier
						}
					}
				}
			}
		}
	}
`;

const PLANNING_PROJECT_DIAGNOSTICS_QUERY = `
	query PlanningProjectDiagnostics($filter: ProjectFilter!, $first: Int!) {
		projects(filter: $filter, first: $first) {
			nodes {
				id
				name
				updatedAt
			}
		}
	}
`;

const selectorPromiseCache = new Map<string, Promise<PublicProjectSelector>>();
const projectRowsPromiseCache = new Map<
	string,
	Promise<{ selector: PublicProjectSelector; rows: Array<Record<string, string>> }>
>();

function requireLinearApiKey() {
	const apiKey = readEnv('LINEAR_API_KEY') ?? '';

	if (!apiKey) {
		throw new Error('LINEAR_API_KEY is required when live Linear content is enabled');
	}

	return apiKey;
}

function isPlainObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function postGraphql<TData>(query: string, variables: Record<string, unknown>) {
	const response = await fetch(GRAPHQL_ENDPOINT, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: requireLinearApiKey(),
		},
		body: JSON.stringify({ query, variables }),
	});

	const json = (await response.json()) as { data?: TData; errors?: unknown[] };

	if (!response.ok || json.errors?.length || !json.data) {
		const details = JSON.stringify(json.errors ?? json, null, 2);
		throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`);
	}

	return json.data;
}

function collectStringArrays(
	value: unknown,
	matcher: (key: string, node: JsonObject) => readonly string[] | null,
	results: string[],
) {
	if (Array.isArray(value)) {
		for (const item of value) {
			collectStringArrays(item, matcher, results);
		}

		return;
	}

	if (!isPlainObject(value)) {
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		if (isPlainObject(child)) {
			const matched = matcher(key, child);

			if (matched) {
				for (const entry of matched) {
					if (!results.includes(entry)) {
						results.push(entry);
					}
				}
			}
		}

		collectStringArrays(child, matcher, results);
	}
}

function normalizePublicProjectSelector(view: LinearCustomViewNode): PublicProjectSelector {
	if (view.modelName !== 'Project') {
		throw new Error(
			`Linear view ${view.name} (${view.id}) is ${view.modelName}; expected a Project view`,
		);
	}

	if (!isPlainObject(view.projectFilterData)) {
		throw new Error(
			`Linear view ${view.name} (${view.id}) is missing projectFilterData`,
		);
	}

	const statusIds: string[] = [];
	const healthValues: string[] = [];

	collectStringArrays(
		view.projectFilterData,
		(key, node) => {
			if (key === 'id' && Array.isArray(node.in) && node.in.every((value) => typeof value === 'string')) {
				return node.in as string[];
			}

			return null;
		},
		statusIds,
	);

	collectStringArrays(
		view.projectFilterData,
		(key, node) => {
			if (
				key === 'healthWithAge' &&
				Array.isArray(node.in) &&
				node.in.every((value) => typeof value === 'string')
			) {
				return node.in as string[];
			}

			return null;
		},
		healthValues,
	);

	return {
		viewId: view.id,
		viewName: view.name,
		statusIds,
		healthValues,
		rawFilter: view.projectFilterData,
	};
}

function buildPlanningTeamFilter() {
	return {
		accessibleTeams: {
			some: {
				or: [
					{ name: { eqIgnoreCase: PLANNING_TEAM_NAME } },
					{ key: { eqIgnoreCase: PLANNING_TEAM_KEY } },
				],
			},
		},
	};
}

function buildPlanningProjectFilter(selector: PublicProjectSelector) {
	return {
		and: [
			buildPlanningTeamFilter(),
			selector.rawFilter,
		],
	};
}

function blockedByIdentifiers(node: LinearIssueNode) {
	return node.inverseRelations.nodes
		.filter((relation) => relation.type === 'blocks')
		.flatMap((relation) => (relation.issue?.identifier ? [relation.issue.identifier] : []))
		.join(', ');
}

function mapProjectNodeToRow(node: LinearProjectNode) {
	return {
		ID: node.id,
		Name: node.name,
		Summary: '',
		Description: node.description ?? '',
		Status: node.status?.name ?? '',
		Health: node.health ?? '',
		Priority: node.priorityLabel ?? '',
		Initiatives: node.initiatives.nodes.map((initiative) => initiative.name).join(', '),
		'Updated At': node.updatedAt,
		'Latest Update': node.lastUpdate?.body ?? '',
		'Latest Update Date': node.lastUpdate?.updatedAt ?? '',
	};
}

function mapIssueNodeToRow(node: LinearIssueNode) {
	return {
		ID: node.identifier,
		UUID: node.id,
		Title: node.title,
		Description: node.description ?? '',
		Status: node.state?.name ?? '',
		Priority: node.priorityLabel ?? '',
		'Project ID': node.project?.id ?? '',
		Project: node.project?.name ?? '',
		Assignee: node.assignee?.name ?? '',
		Created: node.createdAt,
		Updated: node.updatedAt,
		'Blocked by': blockedByIdentifiers(node),
	};
}

function chunk<T>(items: readonly T[], size: number) {
	const chunks: T[][] = [];

	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
}

export function shouldUseLiveLinearContent() {
	const mode = (readEnv('LINEAR_CONTENT_SOURCE') ?? 'auto').trim().toLowerCase();

	if (mode === 'live') {
		return true;
	}

	if (mode === 'scaffold') {
		return false;
	}

	return false;
}

export async function loadPublicProjectSelector(viewId = DEFAULT_PUBLIC_PROJECT_VIEW_ID) {
	const cached = selectorPromiseCache.get(viewId);

	if (cached) {
		return cached;
	}

	const selectorPromise = postGraphql<{ favorites: { nodes: LinearFavoriteNode[] } }>(
		PUBLIC_FAVORITES_QUERY,
		{},
	)
		.then((data) => {
			const favorite = data.favorites.nodes.find(
				(node) =>
					node.type === 'customView' &&
					node.customView &&
					(node.customView.id === viewId ||
						node.customView.name === DEFAULT_PUBLIC_PROJECT_VIEW_NAME ||
						node.title === DEFAULT_PUBLIC_PROJECT_VIEW_NAME),
			);

			if (!favorite?.customView) {
				throw new Error(
					`Unable to resolve favorited Linear custom view ${DEFAULT_PUBLIC_PROJECT_VIEW_NAME} (${viewId})`,
				);
			}

			return normalizePublicProjectSelector(favorite.customView);
		})
		.catch((error) => {
			selectorPromiseCache.delete(viewId);
			throw error;
		});

	selectorPromiseCache.set(viewId, selectorPromise);

	return selectorPromise;
}

export async function loadPlanningProjectsFromPublicView(viewId = DEFAULT_PUBLIC_PROJECT_VIEW_ID) {
	const cached = projectRowsPromiseCache.get(viewId);

	if (cached) {
		return cached;
	}

	const projectPromise = loadPublicProjectSelector(viewId)
		.then(async (selector) => {
			const data = await postGraphql<{ projects: { nodes: LinearProjectNode[] } }>(
				PUBLIC_PROJECTS_QUERY,
				{
					filter: buildPlanningProjectFilter(selector),
					first: PROJECT_BATCH_SIZE,
				},
			);

			return {
				selector,
				rows: data.projects.nodes.map(mapProjectNodeToRow),
			};
		})
		.catch((error) => {
			projectRowsPromiseCache.delete(viewId);
			throw error;
		});

	projectRowsPromiseCache.set(viewId, projectPromise);

	return projectPromise;
}

export async function loadPlanningCompletedIssuesForProjects(projectIds: readonly string[]) {
	if (projectIds.length === 0) {
		return [];
	}

	const rows: Array<Record<string, string>> = [];

	for (const ids of chunk(projectIds, PROJECT_BATCH_SIZE)) {
		const data = await postGraphql<{ issues: { nodes: LinearIssueNode[] } }>(
			PUBLIC_ISSUES_QUERY,
			{
				filter: {
					and: [
						{
							project: {
								id: {
									in: ids,
								},
							},
						},
						{
							state: {
								type: {
									eq: 'completed',
								},
							},
						},
						{
							team: {
								name: {
									eqIgnoreCase: PLANNING_TEAM_NAME,
								},
							},
						},
					],
				},
				first: 250,
			},
		);

		rows.push(...data.issues.nodes.map(mapIssueNodeToRow));
	}

	return rows;
}

export async function getPlanningProjectDiagnostics(): Promise<PublicProjectDiagnostics> {
	const data = await postGraphql<{ projects: { nodes: Array<{ name: string; updatedAt: string }> } }>(
		PLANNING_PROJECT_DIAGNOSTICS_QUERY,
		{
			filter: {
				and: [
					buildPlanningTeamFilter(),
					{
						status: {
							name: {
								eqIgnoreCase: 'In Progress',
							},
						},
					},
				],
			},
			first: PROJECT_BATCH_SIZE,
		},
	);

	const [latestProject] = [...data.projects.nodes].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);

	const warning = latestProject
		? `The \`www\` view resolved zero Planning projects. ${data.projects.nodes.length} Planning projects are still In Progress. Most recently updated: ${latestProject.name}. Update a Planning project status so at least one project is back on track.`
		: 'The `www` view resolved zero Planning projects, and no Planning projects are currently marked In Progress.';

	return {
		inProgressCount: data.projects.nodes.length,
		latestProjectName: latestProject?.name ?? null,
		latestProjectUpdatedAt: latestProject?.updatedAt ?? null,
		warning,
	};
}
