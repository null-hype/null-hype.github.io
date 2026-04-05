export const topNavItems = [
	{ href: '#epistemic', label: 'Frame', active: true },
	{ href: '#cases', label: 'Sequence' },
	{ href: '#comparisons', label: 'Comparisons' },
	{ href: '#forecast', label: 'Forecast' },
];

export const sideRailItems = [
	{ href: '#epistemic', label: 'Contract', icon: 'fact_check', active: true },
	{ href: '#cases', label: 'Nodes', icon: 'timeline' },
	{ href: '#comparisons', label: 'Tests', icon: 'balance' },
	{ href: '#forecast', label: 'Next', icon: 'insights' },
];

export const epistemicFrameContent = {
	eyebrow: 'PLAN-26 // Dossier v3.5',
	title: 'Obviously, It Just Looks That Way.',
	flags: [
		{ label: 'Candidate Signal', tone: 'signal' },
		{ label: 'Perception Matters', tone: 'accent' },
		{ label: 'Needs Scoring', tone: 'muted' },
	],
	boundaryLabel: 'Boundary Condition // What This Dossier Is Not Claiming',
	boundaries: [
		'Not that Assad, Valdai, Maduro, and Khamenei were centrally authored as one hidden operation.',
		'Not that resemblance alone is enough to upgrade coincidence into proof.',
		'Not that contested or inflated events deserve the same evidentiary weight as hard operational facts.',
		'Not that this essay can substitute for a live forecasting framework.',
	],
	thesis:
		'The stronger claim is smaller: once leader-targeting events cluster in a way rivals are forced to read as a message, that interpretive pressure becomes geopolitically real before authorship is settled.',
	paragraphs: [
		'We usually package wars and crises as self-contained episodes. Syria was about Syria. Venezuela was about Maduro. Iran was about nukes. Each gets its own explainer, its own graphic package, and a fresh timeline starting at zero.',
		'This dossier keeps the original pattern-recognition instinct but revises the burden of proof. The interesting question is no longer whether the whole chain has already been proven. The question is whether the chain has become legible enough that serious actors have to price it in.',
		'That is why the next move is neither awe nor dismissal. It is operationalization: define what would strengthen the pattern, what would weaken it, and which future observations deserve to be scored instead of merely admired.',
	],
	annexLabel: 'Proceed to the four-node sequence',
	annexHref: '#cases',
};

export const leadParagraphs = [
	'The four-node sequence is the hook: Bashar al-Assad falls in December 2024, Valdai enters the briefing cycle in December 2025, Nicolas Maduro is extracted on January 3, 2026, and Ayatollah Khamenei is killed on February 28, 2026.',
	'Each event has a local explanation. The question is why, taken together, they begin to look residence-shaped: allied rulers removed, threatened, or publicly framed as vulnerable in or around the places where power was supposed to be most secure.',
	'If you are Moscow, Beijing, or Tehran, you do not get to wave that away as a literary coincidence. You have to decide whether the sequence is noise, message, or the kind of noisy message that still changes behaviour.',
];

export const inlineFigureContent = {
	plateLabel: 'Plate 1.1',
	imageSrc: '/strategic-thicket.svg',
	imageAlt: 'Abstract monochrome topological wave used to visualize clustered strategic pressure.',
	caption:
		'Four residences, three continents, fourteen months. The point is not that the map explains itself. The point is that it has become legible enough to force a reading.',
};

export const caseSectionContent = {
	title: 'Case Sequence',
	eyebrow: 'The chain only matters if each node survives a colder reading.',
	paragraphs: [
		'v3.5 keeps the original sequence but stops pretending every node carries equal evidentiary weight. Assad and Maduro are hard events. Valdai is contested. Khamenei sits inside both alliance politics and wider demonstration.',
		'That unevenness is not a bug to hide. It is part of the argument. The question is not whether the sequence is perfectly tidy. The question is whether it is structured enough that rivals may still be forced to act as if it means something.',
	],
};

export const caseNodes = [
	{
		nodeLabel: 'Node 01 // December 2024',
		title: 'Assad Falls',
		summary:
			'After a decade of Russian investment in Tartus, Khmeimim, arms, and advisers, the Damascus regime collapses in days. Assad flees to Moscow. The first rupture is not abstract: an allied ruler leaves home because the patron can no longer hold the room together.',
		supportingBlock: {
			type: 'grid',
			items: [
				{ label: 'Movement', value: 'Damascus -> Moscow' },
				{ label: 'Role In Sequence', value: 'First hard rupture' },
			],
		},
		counterargument:
			'Syria can still be read as plain battlefield attrition plus Russian overstretch. If that reading is sufficient, the first node weakens any claim that a larger signalling chain is needed at all.',
	},
	{
		nodeLabel: 'Node 02 // December 2025',
		title: 'Valdai Becomes Legible',
		summary:
			"Russia says Ukraine launched 91 drones at Valdai, Putin's retreat. The reporting is thin, the story inflates as it travels, and outside intelligence reportedly doubts it happened. But once the claim enters the system, residence-targeting shifts from event to interpretation.",
		supportingBlock: {
			type: 'grid',
			items: [
				{ label: 'Claim', value: '91 drones / Lavrov' },
				{ label: 'Counter-Signal', value: 'Likely false' },
			],
		},
		counterargument:
			'Valdai is the weak node. If it remains in the chain, it can only stay as evidence that perception matters, not as equal proof. Otherwise the reader is right to suspect bead-stringing after the fact.',
	},
	{
		nodeLabel: 'Node 03 // January 3, 2026',
		title: 'Maduro Extracted',
		summary:
			'U.S. special forces cut through the presidential palace in Caracas, remove Nicolas Maduro, and move him through the USS Iwo Jima to a Brooklyn courthouse. Whatever else it was, it was a vivid demonstration that allied leadership compounds were no longer sacred space.',
		supportingBlock: {
			type: 'list',
			items: [
				{ label: 'Transit', value: 'USS Iwo Jima' },
				{ label: 'End State', value: 'Brooklyn court' },
			],
		},
		counterargument:
			'Maduro may still be a one-off Venezuelan opportunity shaped by local access, intelligence, and timing. The operation does not need a grand chain behind it to make sense on its own terms.',
	},
	{
		nodeLabel: 'Node 04 // February 28, 2026',
		title: 'Khamenei Struck',
		summary:
			'A joint U.S.-Israeli strike kills Ayatollah Khamenei in his compound after thirty-six years in power. The sequence reaches its most lethal point: not exile, not contested threat, not extraction, but irreversible removal at the centre of the Iranian system.',
		supportingBlock: {
			type: 'grid',
			items: [
				{ label: 'Operation', value: 'Joint U.S.-Israeli strike' },
				{ label: 'Aftermath', value: 'Forty days mourning' },
			],
		},
		counterargument:
			"Iran can also be read through Israeli timelines and Netanyahu's long-running agenda. If that explanation saturates the event, the continuity may reflect alliance convenience rather than a coherent chain.",
	},
];

export const pullQuoteContent = {
	quote: 'The sequence does not need to be centrally authored to become geopolitically real.',
	attribution: 'Operational patch',
};

export const evidenceCards = [
	{
		variant: 'metric',
		label: 'Compression // Residences',
		value: '4 / 14',
		description:
			'Four leader residences or compounds inside fourteen months, across three continents and multiple theatres.',
	},
	{
		variant: 'quote',
		label: 'Method // Revision',
		quote:
			'The point is not that the chain is already proven. The point is that it is well-formed enough to interrogate systematically.',
	},
	{
		variant: 'signal',
		label: 'Claim Ladder // v3.5',
		bars: [1, 0.76, 0.52],
		status: 'Resembles a signal -> is read as a signal -> can be scored as a signal.',
	},
];

export const analystCalloutContent = {
	label: 'Analyst Note // Weak Node Discipline',
	text: 'Valdai stays in the dossier only as a lesson in interpretive pressure. If the event was inflated or invented, that does not make it equal proof. It makes it evidence that public claims about leader vulnerability can matter even when the strike itself is contested.',
};

export const sectionBreakContent = {
	title: 'Comparative Tests',
	eyebrow: 'Why this pattern, and why now?',
	meta: 'Two precedents, one warning label, one scoring layer',
};

export const archiveEntries = [
	{
		index: '001',
		title: 'Iraq 2003: Decapitation Without Payoff',
		href: '#iraq-baseline',
		archivalId: 'Comparison: Overfit warning',
		status: 'Status: Warning label',
		statusTone: 'restricted',
	},
	{
		index: '002',
		title: 'Beirut To Grenada: Compensation By Demonstration',
		href: '#beirut-grenada',
		archivalId: 'Comparison: Historical precedent',
		status: 'Status: Strengthens',
		statusTone: 'default',
	},
	{
		index: '003',
		title: 'Aluminium Tubes And The Story-Shaped Trap',
		href: '#tubes-warning',
		archivalId: 'Comparison: Intelligence overreach',
		status: 'Status: Warning label',
		statusTone: 'restricted',
	},
	{
		index: '004',
		title: 'Prediction Markets As The Missing Discipline',
		href: '#forecast-layer',
		archivalId: 'Comparison: Operationalization',
		status: 'Status: Next layer',
		statusTone: 'default',
	},
];

export const comparisonNotes = [
	{
		id: 'iraq-baseline',
		title: 'Iraq 2003 shows why pattern recognition has to pay rent.',
		paragraphs: [
			'The opening decapitation strike on Saddam Hussein is the obvious warning label for this whole style of argument. Fifty leadership strikes, no kills, and civilian deaths anyway is what it looks like when compelling fragments harden into official certainty faster than reality can support them.',
			'That precedent does not kill the current sequence. It sets the evidentiary standard. A good dossier cannot merely feel coherent. It has to survive the possibility that coherence is exactly what makes it dangerous.',
		],
	},
	{
		id: 'beirut-grenada',
		title: 'Beirut to Grenada is the cleanest precedent for compensatory demonstration.',
		paragraphs: [
			'After the 1983 Beirut barracks bombing killed 241 U.S. Marines, the Grenada invasion followed within forty-eight hours. It remains a sharp example of how states answer reputational injury with a demonstration that is legible both operationally and symbolically.',
			"That does not prove today's sequence. It does establish that reputational repair through visible action is not mystical pattern-hunting. It has historical form.",
		],
	},
	{
		id: 'tubes-warning',
		title: 'The essay fails if it can metabolize every contradiction.',
		paragraphs: [
			'This is the strongest red-team critique from the PLAN-26 thread: if every outcome feeds the frame, then the frame is too elegant to trust. A dubious Valdai report, a clean Maduro extraction, an Israel-shaped Iran strike, and a Syrian collapse cannot all count as equally flattering evidence.',
			'The patch is to separate three claims. First, the sequence resembles a signal. Second, rivals may read it as a signal. Third, some of that perception can be turned into testable indicators. Conflating those layers is how the argument turns from analysis into prestige display.',
		],
	},
	{
		id: 'forecast-layer',
		title: 'Prediction is the missing layer between intuition and method.',
		paragraphs: [
			'The original blog closed on a market number. v3.5 keeps the instinct but moves the emphasis. The value of a market or scoring framework is not rhetorical flair. It is that it forces explicit statements about what future observations would strengthen or weaken the hypothesis.',
			'That is why this dossier ends with forward tests rather than a triumphal reveal. If the sequence matters, it should produce questions that can lose.',
		],
	},
];

export const synthesisContent = {
	title: 'From Pattern To Forecast',
	paragraphs: [
		'The strongest version of the essay is no longer "here is the hidden playbook." It is "here is a playbook-shaped pattern, and here is how not to lie to ourselves while investigating it."',
		'That shift matters because perception in adversarial systems is not commentary layered on top of events. It changes bargaining range, retaliation thresholds, and the amount of ambiguity a rival can safely tolerate.',
		'The serious response, then, is pre-registration. Which future residence-targeting events, analyst reactions, market repricings, or retaliatory moves would strengthen the hypothesis? Which would kill it? If we cannot answer that, we are not analysing the pattern. We are just enjoying it.',
	],
};

export const watchlistContent = {
	eyebrow: 'Forward Tests',
	version: 'March 2026',
	title: 'What Would Count Next',
	indicators: [
		{
			label: 'Indicator 01 // Residence Pattern',
			title: 'Another allied-node residence becomes a public target',
			description:
				"Watch for a new leader-compound episode tied to Moscow's remaining network. The signal is not the strike alone but the speed with which it is narrated as part of a chain.",
		},
		{
			label: 'Indicator 02 // Observer Mismatch',
			title: 'Serious observers say the stated motive does not saturate the event',
			description:
				'Comments of the form "there must be something else going on here" are not proof, but they are measurable clues that the official explanation is failing to close the interpretive gap.',
		},
		{
			label: 'Indicator 03 // Forecast Layer',
			title: 'The pattern gets turned into live questions',
			description:
				'If analysts can define scored indicators that would strengthen or weaken the hypothesis, the essay stops behaving like a mood board and starts behaving like research.',
		},
	],
	ctaLabel: 'Define live tests',
	ctaHref: '#forecast-layer',
	dossierId: 'PLAN-26 v3.5 // March 2026',
};

export const footerLinks = [
	{ href: '#epistemic', label: 'Epistemic Contract' },
	{ href: '#cases', label: 'Case Sequence' },
	{ href: '#comparisons', label: 'Comparative Tests' },
	{ href: '#forecast', label: 'Forward Tests' },
];
