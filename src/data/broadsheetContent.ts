export const broadsheetStampContent = {
	label: 'Intent',
	value: 'Obfuscation',
	tone: 'accent' as const,
};

export const fieldNoteCardContent = {
	title: 'Ambient Observations',
	body:
		'Dust accumulation becomes a secondary camouflage layer. If nothing disturbs the object, it slowly joins the room and stops reading as a separate event.',
	reference: 'REF: NOTE_77A // 09:12 PST',
	tone: 'default' as const,
};

export const broadsheetArchiveEntries = [
	{
		index: 'Entry_01',
		title: 'I Hid $1',
		intent: 'Obfuscation',
		summary:
			'A methodology for concealing trivial value so the act of finding becomes the real signal.',
		latestHeadline: 'The Psychology of the Minimalist Ransom',
		href: '#i-hid-1',
	},
	{
		index: 'Entry_02',
		title: "Finder's Log",
		intent: 'Reconnaissance',
		summary:
			'Chronological notes from recovered fragments, false starts, and discoveries that become more interesting in retrospect.',
		latestHeadline: 'Bit-Rot in the Mojave Data Center',
		href: '#finders-log',
		layout: 'tall' as const,
		visualLabel: 'Signal Fragment // server room log',
	},
	{
		index: 'Entry_03',
		title: 'Dead Drop',
		intent: 'Exfiltration',
		summary:
			'Slow channels, delayed reads, and the deliberate use of latency as cover.',
		latestHeadline: 'Latency as a Security Feature',
		href: '#dead-drop',
	},
	{
		index: 'Entry_04',
		title: 'Decoy Pattern',
		intent: 'Misdirection',
		summary:
			'Plausible noise, ordinary traffic, and the craft of making the wrong thing readable.',
		latestHeadline: 'The Aesthetic of Ordinary White Noise',
		href: '#decoy-pattern',
	},
	{
		index: 'Entry_05',
		title: 'Trace Route',
		intent: 'Attribution',
		summary:
			'Follow the invisible hop long enough and a topology starts to confess.',
		latestHeadline: 'Invisible Hops: Navigating the Deep Mesh',
		href: '#trace-route',
	},
	{
		index: 'Entry_06',
		title: 'Recovery Window',
		intent: 'Restoration',
		summary:
			'How long a trace persists after the system thinks it has already let go.',
		latestHeadline: 'Cold Boot Echoes and Phantom Bits',
		href: '#recovery-window',
	},
	{
		index: 'Entry_07',
		title: 'Reveal Surface',
		intent: 'Decryption',
		summary:
			'The moment structure emerges from noise and becomes impossible to unread.',
		latestHeadline: 'The Singular Moment of Clear-Text Manifestation',
		href: '#reveal-surface',
		layout: 'wide' as const,
		locked: true,
		lockedLabel: 'Access Required',
	},
] as const;

export const broadsheetArchiveViewContent = {
	masthead: 'Steganography Content Engine',
	reference: 'Bureau of Digital Exhumation // File Ref 441',
	sideNav: [
		{ label: 'Chronology', active: true },
		{ label: 'Geolocation' },
		{ label: 'Metadata' },
		{ label: 'Taxonomy' },
		{ label: 'Citations' },
		{ label: 'Index' },
	],
	noteEyebrow: 'Editorial No. 01',
	noteTitle: 'Hidden Intent and Planted Signals',
	noteParagraphs: [
		'In this publication, visibility is usually a byproduct of failure. The interesting work lives in the unseen middle, where signals are planted, misread, recovered, and only later recognized as deliberate.',
		'The engine acts less like a blog and more like an archive shelf: each series studies one recurring relationship between hider and finder, between concealment and interpretation.',
	],
	figureLabel: 'Signal Map Reference // 42.112 - 70.441',
	entries: broadsheetArchiveEntries,
	stats: [
		{ label: 'Files Exhumed', value: '1.4M' },
		{ label: 'Active Nodes', value: '842' },
		{ label: 'Latest Update', value: '2s ago' },
	],
};

export const broadsheetArticleViewContent = {
	masthead: 'I Hid $1',
	railItems: ['Chronology', 'Geolocation', 'Metadata', 'Related'],
	metadata: [
		{ label: 'Series', value: 'I Hid $1' },
		{ label: 'Intent', value: 'Obfuscation' },
		{ label: 'Entry', value: '001' },
		{ label: 'Evidence Grade', value: 'Alpha' },
	],
	title: 'The Silence of One Dollar: A Study in Trivial Concealment',
	deck: 'An exploration of intent, attention, and the psychology of the missed object.',
	sections: [
		{
			heading: 'The Geometry of the Hide',
			paragraphs: [
				'Concealment is rarely about depth. It is about the friction of the gaze and the precise point where expectation stops scanning the room.',
				'A dollar bill can disappear in liminal spaces: under the felt of a coaster, behind a frame backing, or folded into the sort of paper people no longer believe matters.',
			],
		},
		{
			heading: 'The Observer Effect',
			paragraphs: [
				'The observer does not search for what they do not expect to find. That blind spot is the real substrate of trivial obfuscation.',
				'Once an object drops below threat value and utility relevance, it becomes part of the room rather than an interruption inside it.',
			],
		},
	],
	pullQuote: {
		quote:
			'In a world of high-stakes encryption, the most effective cipher is often the one that costs nothing.',
	},
	figure: {
		plateLabel: 'Fig. 1.2',
		imageSrc: '/strategic-thicket.svg',
		imageAlt: 'Abstract topological wave used as a placeholder for cone-of-invisibility mapping.',
		caption:
			'Placeholder diagram for the cone of invisibility: zones where a thin object becomes visually ordinary long before it becomes physically hidden.',
	},
	fieldNotes: [
		fieldNoteCardContent,
		{
			title: 'Historical Context',
			body:
				'Late 19th-century parlor games used small hidden tokens to measure attention, alertness, and social confidence. The object mattered less than the ritual of finding it.',
			reference: 'ARCHIVE_SRC: VOL. IV',
			tone: 'accent' as const,
		},
	],
	previousEntry: {
		title: 'Steganography 101',
		description: 'The digital layer of hidden signals.',
		href: '#previous',
	},
	nextEntry: {
		title: 'The Art of the Decoy',
		description: 'Constructing diversions to protect the core.',
		href: '#next',
	},
};

export const broadsheetDispatchViewContent = {
	masthead: 'Archival Dispatch',
	series: "Finder's Log",
	issue: 'Dispatch 08',
	stamps: [
		{ label: 'Intent', value: 'Reconnaissance', tone: 'signal' as const },
		{ label: 'Status', value: 'Verified', tone: 'muted' as const },
	],
	title: 'The Expected Discovery',
	author: 'The Anonymous Curator',
	timestamp: '2024.08.14.04:12',
	thesis:
		"When expectation meets reality, the narrative of discovery shifts. People who find what they were looking for narrate the moment as a logical conclusion, while accidental finders reach for intervention, glitch, or fate.",
	observations: [
		{
			index: '01',
			title: "The 'Pre-Destined' Narrative",
			body:
				'Found objects are absorbed into existing mental frameworks. The finder experiences completion, not surprise.',
		},
		{
			index: '02',
			title: "The 'Anomaly' Narrative",
			body:
				'Unexpected finds behave like disruptions in the timeline. They feel out of place before they feel useful.',
			offset: true,
		},
		{
			index: '03',
			title: "The 'Vanishing Point' Narrative",
			body:
				'Finding something that was never lost creates a feedback loop: the object confirms itself more than it resolves a need.',
		},
	],
	quote:
		'In the archive, you find what you are looking for. In the field, you find what is looking for you.',
	citation: 'Anonymous Curator',
	links: [
		{ label: 'Read Full Archive Entry', href: '#full' },
		{ label: 'Previous Dispatch: I Hid $1', href: '#previous', subdued: true },
		{ label: 'Next Dispatch: Dead Drop', href: '#next', subdued: true },
	],
};
