export const topNavItems = [
	{ href: '#epistemic', label: 'Epistemic', active: true },
	{ href: '#cases', label: 'Cases' },
	{ href: '#deep-archives', label: 'Archives' },
	{ href: '#synthesis', label: 'Synthesis' },
];

export const sideRailItems = [
	{ href: '#epistemic', label: 'Thesis', icon: 'analytics', active: true },
	{ href: '#cases', label: 'Evidence', icon: 'database' },
	{ href: '#synthesis', label: 'Counter', icon: 'security' },
];

export const epistemicFrameContent = {
	eyebrow: 'Document IA-0422',
	title: 'The Jungle Roars Back.',
	flags: [
		{ label: 'Probable', tone: 'signal' },
		{ label: 'Contested', tone: 'muted' },
		{ label: 'Ref: J.R.W-2024', tone: 'muted' },
	],
	boundaryLabel: 'Boundary Condition // What This Is Not Claiming',
	boundaries: [
		'Not a prediction of inevitable structural collapse.',
		'Not a moral endorsement of asymmetric tactics.',
		'Not a dismissal of institutional agency.',
		'Not a linear projection of historical patterns.',
	],
	thesis:
		'“The garden is a myth of the late 20th century. What we are witnessing is not a temporary lapse in order, but the re-emergence of the primordial strategic environment, a thicket of competing wills where noise is the only constant.”',
	paragraphs: [
		"In the archival tradition of intelligence analysis, we often speak of the signal and the noise. Yet this binary fails to capture the contemporary shift toward a multi-scalar, non-linear warfare state. The epistemic frame through which we view global instability has cracked. We are no longer observing a chessboard; we are traversing a jungle.",
		"Our analysis suggests that the current erosion of international norms is not a descent into darkness, but a return to a historical mean. The post-Cold War garden was an anomaly supported by unprecedented unipolar hegemony. As that hegemony thins, the vegetative growth of regional ambitions reclaims the landscape.",
	],
	annexLabel: 'Open Technical Annex A-1',
	annexHref: '#technical-annex-1',
};

export const inlineFigureContent = {
	plateLabel: 'Plate 1.1',
	imageSrc: '/strategic-thicket.svg',
	imageAlt: 'Abstract monochrome topological wave representing a strategic thicket.',
	caption:
		"Visualizing the strategic thicket: a placeholder topology of grey-zone actor influence, dense signal overlap, and resource flow across contested boundaries.",
};

export const caseNodes = [
	{
		nodeLabel: 'Node 01 // 2011-Present',
		title: 'The Assad Resilience',
		summary:
			'The survival of the Damascus regime represents the first major rupture in the liberal interventionist consensus. By leveraging localized attrition and external patrons, the regime maintained its core structure.',
		supportingBlock: {
			type: 'grid',
			items: [
				{ label: 'Signal-7 Homs', value: 'Status: Persistent Noise' },
				{ label: 'Dossier: Urban', value: 'Ref: SY-11-LOGS' },
			],
		},
		counterargument:
			'Assumes regime survival is synonymous with control. Intelligence indicates fragmented sovereignty where central authority is performative and heavily leveraged to external creditors.',
	},
	{
		nodeLabel: 'Node 02 // 2022-Present',
		title: 'The Valdai Pivot',
		summary:
			'The shift toward a civilizational-state model marks an explicit rejection of universalist norms. Placeholder copy here tracks kinetic force alongside insulation through alternate swap networks.',
		supportingBlock: {
			type: 'button',
			label: 'Annex-C: Pipeline Topology',
			href: '#annex-c',
		},
		counterargument:
			'The pivot is resource-dependent and geographically bounded. Exhaustion rates of technical talent suggest a terminal failure unless tertiary fronts materialize.',
	},
	{
		nodeLabel: 'Node 03 // 2018-Present',
		title: 'The Maduro Endurance',
		summary:
			'Defying total economic decoupling through the creation of parallel value lanes. A placeholder survival logic built on institutional opacity, non-state alliance, and selective invisibility.',
		supportingBlock: {
			type: 'list',
			items: [
				{ label: 'Illegal Mining Revenue', value: '[REDACTED]' },
				{ label: 'Crypto-Liquidity Nodes', value: '14 Primary' },
			],
		},
		counterargument:
			'Survival is bought at the cost of infrastructural rot. The state is less a coherent polity than a set of fortified extraction zones managed by competing proxies.',
	},
	{
		nodeLabel: 'Node 04 // 1979-Present',
		title: 'The Khamenei Doctrine',
		summary:
			'The longest-running experiment in anti-unipolar posture. Placeholder copy here emphasizes proxy depth and calibrated escalation designed to paralyze institutional response.',
		supportingBlock: {
			type: 'link',
			label: 'Review Proxy Map 04-B',
			href: '#proxy-map-04-b',
		},
		counterargument:
			'Demographic fatigue is the invisible counter-signal. The doctrine fails to account for an urbanized youth population whose goals are increasingly detached from the ideological core.',
	},
];

export const pullQuoteContent = {
	quote: 'The goal is not to win, but to outlast the observer’s attention span.',
};

export const evidenceCards = [
	{
		variant: 'metric',
		label: 'Data Entry // 042',
		value: '1.4B',
		description: 'Sanctioned entities operating within shadow fleet networks globally.',
	},
	{
		variant: 'quote',
		label: 'Citation // Ref. 88',
		quote:
			'“The geography of power is now defined by the reach of the un-trackable transaction, not the breadth of the monitored border.”',
	},
	{
		variant: 'signal',
		label: 'Signal // Polar-X',
		bars: [1, 0.66, 0.82],
		status: 'Arctic Buoy Alpha-7 Status: Active',
	},
];

export const analystCalloutContent = {
	label: 'Analyst Note // 24-B',
	text: '“Notice the shift from territorial defense to network persistence. The physical geography is secondary to the uptime of the clandestine transaction pipeline.”',
};

export const sectionBreakContent = {
	title: 'Deep Archives',
	eyebrow: 'Authorized Access Only',
	meta: 'Clearance Level: Spectre-7',
};

export const archiveEntries = [
	{
		index: '001',
		title: 'Iraq Decapitation Baseline',
		href: '#iraq-baseline',
		archivalId: 'Archival-ID: IQ-03-DB',
		status: 'Status: Unclassified',
		statusTone: 'default',
	},
	{
		index: '002',
		title: 'Beirut to Grenada Demonstration',
		href: '#beirut-grenada',
		archivalId: 'Archival-ID: LB-83-GR',
		status: 'Status: Restrict-S',
		statusTone: 'restricted',
	},
];

export const synthesisContent = {
	title: 'Synthesis: The Roar as Equilibrium',
	paragraphs: [
		"We conclude that the jungle is not a failure of system design, but the default state of human strategic interaction. The roars we hear, the populist uprisings, the revanchist state maneuvers, the widening informal economies, are not glitches to be patched.",
		'Stability is no longer found in walls or sanctions, but in the ability to navigate through the roaring wave of the future. The analyst must move beyond the signal and become a navigator of noise.',
	],
};

export const watchlistContent = {
	eyebrow: 'Forward-Looking Test Set',
	version: 'Ver: 2025-2028',
	title: 'Watchlist Indicators',
	indicators: [
		{
			label: 'Indicator 01 // Financial Decoupling',
			title: 'De-Dollarization of Grey Markets',
			description:
				"Watch for the emergence of a shadow IMF: bilateral swap lines between Southeast Asian nodes and Gulf patrons, bypassing visible audit trails through proprietary ledger protocols.",
		},
		{
			label: 'Indicator 02 // Resource Sovereignty',
			title: 'Arctic No-Fly Territorial Claims',
			description:
				'Placeholder synthesis points to hardened buoy fields and a transition from dormant territorial claims to area-access denial through autonomous maritime sensors.',
		},
		{
			label: 'Indicator 03 // Biometric Hardening',
			title: 'Sahelian Digital Enclosures',
			description:
				'Look for the deployment of proprietary biometric databases as the new currency of local governance, extraction contracts, and tribal alignment.',
		},
	],
	ctaLabel: 'Submit Analysis Feedback',
	dossierId: 'Dossier ID: 992-XRAY-ALPHA',
};

export const footerLinks = [
	{ href: '#classified-index', label: 'Classified Index' },
	{ href: '#methodology', label: 'Methodology' },
	{ href: '#source-map', label: 'Source Map' },
	{ href: '#red-team-protocols', label: 'Red Team Protocols' },
];
