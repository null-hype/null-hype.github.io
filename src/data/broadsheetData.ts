export const dispatchesData = [
	{
		title: 'Australian MCP Field Notes',
		body: 'Public dispatches on the emerging Australian MCP and agentic infrastructure scene, derived from LinkedIn reconnaissance.',
		href: '/field-notes',
		latestUpdate: 'I spent two weeks mapping the scene — who is building, who is hiring...',
	},
	{
		title: 'Broadsheet',
		body: 'Article publishing pipeline — steganography content engine, article-from-linear skill, and editorial production.',
		href: '/broadsheet/grammar-as-protocol',
		latestUpdate: 'Write: "Grammar as Protocol" (In Progress)',
	},
	{
		title: 'Six Domains, One Stack',
		body: 'The Grammar as Protocol thesis applied across six domains — SAT math, German grammar, music theory, security scanning, operational scheduling, and argumentation.',
		href: '/six-domains',
		latestUpdate: 'Grammars are compiled expertise. An expensive model writes the rules once.',
	},
];

export const platformsData = [
	{
		title: 'Empire State',
		body: 'Swipe-based human-in-the-loop decision surface for autonomous agents. Tinder for agent plans.',
		href: '/empire-state',
	},
	{
		title: 'Falada',
		body: 'The headless agentic video editor. Mobile-first control of remote high-performance render hardware.',
		href: '/falada',
	},
	{
		title: 'BountyBench',
		body: 'The Dagger calibration harness. Isolate environment setup from security reasoning.',
		href: '/bounty-bench',
	},
	{
		title: 'Jules × Render',
		body: 'Autonomous fix loop plumbing proof. Jules GH App fixes failing tests via Dagger pipe.',
		href: '/jules-render',
	},
];

export const dummySlots = Array.from({ length: 39 }, (_, i) => ({
	id: `TL-${String(i + 1).padStart(3, '0')}`,
	moon: Math.floor(i / 3) + 1,
	phase: ['waxing', 'full', 'waning'][i % 3] as 'waxing' | 'full' | 'waning',
	status: ['pool', 'sea', 'rain'][Math.floor(Math.random() * 3)] as 'pool' | 'sea' | 'rain',
	label: `Agent Slot ${i + 1}`,
}));
