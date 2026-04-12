type CsvRow = Record<string, string>;

type LinearProjectNode = {
	id: string;
	name: string;
	description: string | null;
	priorityLabel: string | null;
	updatedAt: string;
	status: {
		name: string;
	} | null;
	initiatives: {
		nodes: Array<{
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
	updatedAt: string;
	state: {
		name: string;
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

const GRAPHQL_ENDPOINT = process.env.LINEAR_GRAPHQL_ENDPOINT ?? 'https://api.linear.app/graphql';
const BATCH_SIZE = 50;

const PROJECTS_QUERY = `
	query ProjectsById($ids: [ID!]) {
		projects(filter: { id: { in: $ids } }, first: 250) {
			nodes {
				id
				name
				description
				priorityLabel
				updatedAt
				status {
					name
				}
				initiatives(first: 20) {
					nodes {
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

const ISSUES_QUERY = `
	query IssuesById($ids: [ID!]) {
		issues(filter: { id: { in: $ids } }, first: 250) {
			nodes {
				id
				identifier
				title
				description
				priorityLabel
				updatedAt
				state {
					name
				}
				assignee {
					name
				}
				project {
					id
					name
				}
				inverseRelations(first: 20) {
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

function chunk<T>(items: readonly T[], size: number): T[][] {
	const chunks: T[][] = [];

	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
}

function requireLinearApiKey() {
	const apiKey = process.env.LINEAR_API_KEY ?? '';

	if (!apiKey) {
		throw new Error('LINEAR_API_KEY is required when live Linear content is enabled');
	}

	return apiKey;
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

	const json = await response.json();

	if (!response.ok || json.errors?.length) {
		const details = JSON.stringify(json.errors ?? json, null, 2);
		throw new Error(`Linear GraphQL request failed: ${response.status} ${details}`);
	}

	return json.data as TData;
}

function assertAllIdsResolved(kind: 'issues' | 'projects', scaffoldIds: readonly string[], liveIds: Iterable<string>) {
	const resolved = new Set(liveIds);
	const missing = scaffoldIds.filter((id) => !resolved.has(id));

	if (missing.length > 0) {
		throw new Error(
			`Live Linear ${kind} lookup did not resolve all scaffold IDs. Missing ${kind}: ${missing.join(', ')}`,
		);
	}
}

function blockedByIdentifiers(node: LinearIssueNode) {
	return node.inverseRelations.nodes
		.filter((relation) => relation.type === 'blocks')
		.flatMap((relation) => (relation.issue?.identifier ? [relation.issue.identifier] : []))
		.join(', ');
}

export function shouldUseLiveLinearContent() {
	const mode = (process.env.LINEAR_CONTENT_SOURCE ?? 'auto').trim().toLowerCase();

	if (mode === 'live') {
		return true;
	}

	if (mode === 'scaffold') {
		return false;
	}

	return process.env.NODE_ENV === 'production';
}

export async function overlayLiveProjects(scaffoldRows: readonly CsvRow[]) {
	const projectIds = scaffoldRows.map((row) => row.ID).filter(Boolean);
	const liveProjects = new Map<string, LinearProjectNode>();

	for (const ids of chunk(projectIds, BATCH_SIZE)) {
		const data = await postGraphql<{ projects: { nodes: LinearProjectNode[] } }>(PROJECTS_QUERY, { ids });

		for (const node of data.projects.nodes) {
			liveProjects.set(node.id, node);
		}
	}

	assertAllIdsResolved('projects', projectIds, liveProjects.keys());

	return scaffoldRows.map((row) => {
		const live = liveProjects.get(row.ID);

		if (!live) {
			throw new Error(`Missing live Linear project for scaffold row ${row.ID}`);
		}

		return {
			...row,
			Name: live.name,
			Description: live.description ?? '',
			Status: live.status?.name ?? '',
			Priority: live.priorityLabel ?? '',
			Initiatives: live.initiatives.nodes.map((initiative) => initiative.name).join(', '),
			'Updated At': live.updatedAt,
			'Latest Update': live.lastUpdate?.body ?? '',
			'Latest Update Date': live.lastUpdate?.updatedAt ?? '',
		};
	});
}

export async function overlayLiveIssues(scaffoldRows: readonly CsvRow[]) {
	const issueIds = scaffoldRows.map((row) => row.UUID).filter(Boolean);
	const liveIssues = new Map<string, LinearIssueNode>();

	for (const ids of chunk(issueIds, BATCH_SIZE)) {
		const data = await postGraphql<{ issues: { nodes: LinearIssueNode[] } }>(ISSUES_QUERY, { ids });

		for (const node of data.issues.nodes) {
			liveIssues.set(node.id, node);
		}
	}

	assertAllIdsResolved('issues', issueIds, liveIssues.keys());

	return scaffoldRows.map((row) => {
		const live = liveIssues.get(row.UUID);

		if (!live) {
			throw new Error(`Missing live Linear issue for scaffold row ${row.ID || row.UUID}`);
		}

		return {
			...row,
			ID: live.identifier,
			Title: live.title,
			Description: live.description ?? '',
			Status: live.state?.name ?? '',
			Priority: live.priorityLabel ?? '',
			'Project ID': live.project?.id ?? '',
			Project: live.project?.name ?? '',
			Assignee: live.assignee?.name ?? '',
			Updated: live.updatedAt,
			'Blocked by': blockedByIdentifiers(live),
		};
	});
}
