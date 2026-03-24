export const nowPageMeta = {
	lastUpdated: 'March 24, 2026',
	title: 'What I am doing now',
	intro: [
		'This page is pulled from the shape of the work, not from an aspirational bio. Right now the center of gravity is turning the PLAN-26 essay successor into a real web artifact.',
		'The useful constraint is that everything has to cash out in the same place: Storybook components, Astro composition, a deployable site, and a dossier that is disciplined enough to survive contact with its own critique.',
	],
	footer:
		'If this page looks stale, it probably is. The backlog moves faster than the prose.',
} as const;

export const nowItems = [
	{
		title: 'Turn the essay into the artifact',
		body:
			'I am composing the Storybook editorial components into the live Astro reading experience and replacing placeholder copy with the v3.5 dossier text from PLAN-26.',
		references: 'Linear: PLAN-163, PLAN-26',
	},
	{
		title: 'Finish the reusable component layer',
		body:
			'I am keeping the component library coherent enough that this site is not a one-off build. The point is an editorial system that can carry later essays without starting over.',
		references: 'Linear: PLAN-142',
	},
	{
		title: 'Make publication boring',
		body:
			'I am lining up the deployment path early so the site can move cleanly from local build to preview and then to the canonical URL without a last-minute packaging scramble.',
		references: 'Linear: PLAN-167, PLAN-152',
	},
	{
		title: 'Protect the wider editorial platform',
		body:
			'I am keeping one eye on the Falada stress tests and production-pipeline notes, but only enough to preserve momentum. They are supporting work, not permission to drift away from shipping this essay.',
		references: 'Linear: PLAN-18, PLAN-13, PLAN-14, PLAN-15, PLAN-19, PLAN-20, PLAN-21, PLAN-22',
	},
] as const;

export const recentlyDoneItems = [
	{
		title: 'The first full editorial prototype exists',
		body:
			'The Stitch prototype is done. That means the open questions are no longer about vague layout direction. They are now about implementation fidelity, argument quality, and integration.',
		references: 'Linear: PLAN-137',
	},
] as const;

export const notNowItems = [
	{
		title: 'Collecting more parallel projects for their own sake',
		body:
			'I am not trying to turn the site, the backlog, the component library, and the essay into four separate hobbies. The useful job is convergence.',
		references: 'Linear: PLAN-142, PLAN-163, PLAN-167',
	},
	{
		title: 'Pretending the argument is already proven',
		body:
			'I am not trying to publish a grand unified theory of hidden coordination. The current standard is smaller and harder: define what would make the pattern stronger, weaker, or obviously overfit.',
		references: 'Linear: PLAN-26, PLAN-115, PLAN-116',
	},
] as const;
