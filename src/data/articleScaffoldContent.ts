export type ScaffoldRelationType = 'blockedBy' | 'mapsTo' | 'supports';

export interface ScaffoldRelation {
	readonly type: ScaffoldRelationType;
	readonly target: string;
}

export interface ArticleScaffoldNode {
	readonly kind: 'issue' | 'sub-issue';
	readonly id: string;
	readonly title: string;
	readonly paragraphs: readonly string[];
	readonly status: string;
	readonly priority?: string;
	readonly tags?: readonly string[];
	readonly sectionLabel?: string;
	readonly relations?: readonly ScaffoldRelation[];
	readonly subIssues?: readonly ArticleScaffoldNode[];
}

export interface ArticleScaffoldMilestone {
	readonly title: string;
	readonly paragraphs: readonly string[];
	readonly status: string;
	readonly decision: string;
}

export interface ArticleScaffoldContent {
	readonly projectTitle: string;
	readonly projectSummary: string;
	readonly articleTitle: string;
	readonly articleDek: string;
	readonly milestone: ArticleScaffoldMilestone;
	readonly issues: readonly ArticleScaffoldNode[];
	readonly latestUpdateLabel: string;
	readonly latestUpdateText: string;
}

const domainSubIssues: readonly ArticleScaffoldNode[] = [
	{
		kind: 'sub-issue',
		id: 'SEC-01',
		title: 'SAT Math',
		paragraphs: [
			'In SAT math, the grammar encodes equation structure: what counts as a valid linear equation, a quadratic, or a system. The parser rejects malformed expressions before the agent attempts a solution, and the state machine enforces the allowed moves inside the solving process.',
		],
		status: 'Derived',
		tags: ['example', 'domain-proof'],
		relations: [{ type: 'mapsTo', target: 'Isomorphism proof subsection' }],
	},
	{
		kind: 'sub-issue',
		id: 'SEC-02',
		title: 'German Grammar',
		paragraphs: [
			'In German grammar, the same stack becomes case and agreement enforcement. The configuration layer knows which prepositions require dative, the parser validates sentence structure, and the state machine refuses transitions that violate agreement.',
		],
		status: 'Derived',
		tags: ['example', 'language'],
		relations: [{ type: 'mapsTo', target: 'Isomorphism proof subsection' }],
	},
	{
		kind: 'sub-issue',
		id: 'SEC-03',
		title: 'Music Theory',
		paragraphs: [
			'In music theory, intervals, chord construction, and harmonic expectation become parseable structure. A dominant seventh parses as a specific object, and functional harmony becomes a state machine that constrains what resolutions make sense next.',
		],
		status: 'Derived',
		tags: ['example', 'music'],
		relations: [{ type: 'mapsTo', target: 'Isomorphism proof subsection' }],
	},
	{
		kind: 'sub-issue',
		id: 'SEC-04',
		title: 'Security Scanning',
		paragraphs: [
			'In security scanning, the grammar encodes observable HTTP signals and allowed scan actions, while the state machine models expected system behavior. The vulnerability candidate appears at the point where the observed transition diverges from the permitted one.',
		],
		status: 'Derived',
		tags: ['example', 'security'],
		relations: [{ type: 'mapsTo', target: 'Isomorphism proof subsection' }],
	},
	{
		kind: 'sub-issue',
		id: 'SEC-05',
		title: 'Operational Scheduling',
		paragraphs: [
			'In operational scheduling, the grammar is the calendar itself: named slots, phases, and valid assignment windows. Invalid transitions are not advisory mistakes; they fail structurally before dispatch can proceed.',
		],
		status: 'Derived',
		tags: ['example', 'operations'],
		relations: [{ type: 'mapsTo', target: 'Isomorphism proof subsection' }],
	},
	{
		kind: 'sub-issue',
		id: 'SEC-06',
		title: 'Argumentation',
		paragraphs: [
			'In argumentation, the grammar encodes claims, warrants, evidence, and rebuttals as structural requirements. An essay without a warrant does not merely feel weak; it becomes a malformed object in the same way a bad parse tree is malformed.',
		],
		status: 'Derived',
		tags: ['example', 'rhetoric'],
		relations: [{ type: 'mapsTo', target: 'Isomorphism proof subsection' }],
	},
];

export const grammarAsProtocolScaffold: ArticleScaffoldContent = {
	projectTitle: 'Six Domains, One Stack',
	projectSummary:
		'The Grammar as Protocol thesis is scaffolded in Linear as one project with one milestone, two primary issues, and a dependency that determines reading order.',
	articleTitle: 'Grammar as Protocol: How Formal Constraints Enable Agentic Security Research',
	articleDek:
		'The milestone and issue graph stays in Linear, but the public output reads as one continuous essay rather than a pile of disjointed planning objects.',
	milestone: {
		title: 'Grammar as Protocol',
		paragraphs: [
			'Grammars are compiled expertise. An expensive model writes the rules once; a constrained model enforces them forever.',
			'In Linear, the milestone is not public metadata. It is the scaffold that groups the thesis article, the proof article, and the implied reading order that later collapses into one longform piece.',
		],
		status: 'In Progress',
		decision: 'Use milestone scope as article boundary and issue order as section order.',
	},
	issues: [
		{
			kind: 'issue',
			id: 'PLAN-229',
			title: 'The Four-Layer Stack',
			paragraphs: [
				'The thesis is simple: grammars are compiled expertise. An advanced model analyzes a domain and produces formal rules; a constrained model consumes those rules at runtime. No parse match, no action.',
				'The architecture has four layers, and they are the same everywhere the thesis applies. Pkl defines the contract, Tree-sitter enforces structure, XState models valid transitions, and the agent operates inside those constraints rather than above them.',
				'The value lies in the compilation step. Expensive expertise becomes cheap enforcement, and the agent inherits discipline from the grammar instead of improvising it at runtime.',
			],
			status: 'In Review',
			priority: 'Urgent',
			tags: ['architecture', 'thesis'],
			relations: [{ type: 'mapsTo', target: 'Article thesis and architecture frame' }],
		},
		{
			kind: 'issue',
			id: 'PLAN-230',
			title: 'The Isomorphism',
			paragraphs: [
				'The claim that the four-layer stack applies across domains is only interesting if the isomorphism can be shown concretely. The point is not metaphor. The point is structural repetition.',
				'This issue is blocked by the first one because the proof only works once the architecture has been made legible. Once the stack exists, the same constraint pattern can be demonstrated across six separate domains without changing the underlying logic.',
			],
			status: 'In Review',
			priority: 'High',
			tags: ['proof', 'cross-domain'],
			relations: [
				{ type: 'blockedBy', target: 'PLAN-229' },
				{ type: 'mapsTo', target: 'Article proof sequence' },
			],
			subIssues: domainSubIssues,
		},
	],
	latestUpdateLabel: 'Series note',
	latestUpdateText:
		'Two articles lay out the Grammar as Protocol thesis and then prove it across six domains. The public page should read like one continuous entry even though the source structure remains milestone -> issues -> derived sub-issues.',
};
