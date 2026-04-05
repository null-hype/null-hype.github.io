export interface Moon {
	readonly cycle: number;
	readonly verb: string;
	readonly domain: string;
}

export interface Phase {
	readonly name: 'waxing' | 'full' | 'waning';
	readonly timezone: 'APAC' | 'EMEA' | 'Americas';
	readonly utcBand: string;
	readonly cronHour: number;
}

export interface TidelaneNode {
	readonly index: number;
	readonly slug: string;
	readonly w3w: string;
	readonly moon: Moon;
	readonly phase: Phase;
	readonly cron: string;
	readonly smallwebArgs: readonly string[];
}

const VERBS = [
	'coordinate',
	'excavate',
	'triangulate',
	'synthesize',
	'intercept',
	'enumerate',
	'calibrate',
	'transpose',
	'arbitrate',
	'cultivate',
	'distill',
	'navigate',
	'reconcile',
] as const;

const DOMAINS = [
	'orchestration',
	'reconnaissance',
	'constraint-design',
	'signal-analysis',
	'boundary-testing',
	'pattern-extraction',
	'calibration',
	'translation',
	'arbitration',
	'cultivation',
	'distillation',
	'navigation',
	'reconciliation',
] as const;

const W3W_POOL = [
	'castle',
	'jungle',
	'methods',
	'roaring',
	'crushing',
	'huggable',
	'island',
	'revealed',
	'anchor',
	'drifting',
	'gentle',
	'hollow',
	'blazing',
	'copper',
	'festival',
	'harvest',
	'lantern',
	'marble',
	'nesting',
	'orbital',
	'pebble',
	'quilted',
	'ridgeline',
	'sailing',
	'timber',
	'umbrella',
	'vaulted',
	'winding',
	'yielding',
	'zigzag',
	'alpine',
	'bramble',
	'chimney',
	'droplet',
	'ember',
	'frosted',
	'glacier',
	'hammock',
	'inkwell',
	'jasmine',
	'kettle',
	'limestone',
	'meadow',
	'nautical',
	'outpost',
	'planter',
	'rampart',
	'scaffold',
	'terrace',
	'undergrowth',
	'venture',
	'whisker',
	'zenith',
	'basalt',
	'canopy',
	'dappled',
	'estuary',
	'flannel',
	'granite',
	'harbor',
	'ivory',
	'juniper',
	'kindling',
	'lattice',
	'mulberry',
	'nimbus',
	'obsidian',
	'pavilion',
	'quarry',
	'rosemary',
	'summit',
	'trestle',
	'upland',
	'verdant',
	'willow',
	'cypress',
	'biscuit',
	'carousel',
] as const;

export const TIDELANE_PHASES: readonly Phase[] = [
	{ name: 'waxing', timezone: 'APAC', utcBand: 'UTC+8..+12', cronHour: 2 },
	{ name: 'full', timezone: 'EMEA', utcBand: 'UTC+0..+3', cronHour: 10 },
	{ name: 'waning', timezone: 'Americas', utcBand: 'UTC-5..-8', cronHour: 18 },
] as const;

function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function generateW3W(rand: () => number, used: Set<string>) {
	let attempts = 0;

	while (attempts < 100) {
		const a = W3W_POOL[Math.floor(rand() * W3W_POOL.length)];
		const b = W3W_POOL[Math.floor(rand() * W3W_POOL.length)];
		const c = W3W_POOL[Math.floor(rand() * W3W_POOL.length)];

		if (a !== b && b !== c && a !== c) {
			const address = `${a}.${b}.${c}`;

			if (!used.has(address)) {
				used.add(address);
				return address;
			}
		}

		attempts++;
	}

	throw new Error('w3w generation exhausted');
}

export function generateTidelaneNodes(seed: number): TidelaneNode[] {
	const rand = mulberry32(seed);
	const usedW3W = new Set<string>();
	const nodes: TidelaneNode[] = [];
	const moons: Moon[] = VERBS.map((verb, index) => ({
		cycle: index + 1,
		verb,
		domain: DOMAINS[index],
	}));
	const moonW3Ws = moons.map(() => generateW3W(rand, usedW3W));

	let index = 0;

	for (const [moonIndex, moon] of moons.entries()) {
		for (const phase of TIDELANE_PHASES) {
			const w3w = moonW3Ws[moonIndex];
			const phaseShort = phase.timezone === 'Americas' ? 'amer' : phase.timezone.toLowerCase();
			const minuteOffset = (moonIndex * 4) % 60;

			nodes.push({
				index,
				slug: `${w3w.split('.')[0]}-${phaseShort}`,
				w3w,
				moon,
				phase,
				cron: `${minuteOffset} ${phase.cronHour} * * *`,
				smallwebArgs: ['dispatch', phase.timezone, `cycle-${moon.cycle}`, w3w],
			});

			index++;
		}
	}

	return nodes;
}

export function toSmallwebJson(nodes: readonly TidelaneNode[]) {
	return {
		crons: nodes.map((node) => ({
			schedule: node.cron,
			args: [...node.smallwebArgs],
		})),
	};
}

export function toSmallwebApps(nodes: readonly TidelaneNode[]) {
	return nodes.map((node) => ({
		folder: `~/smallweb/${node.slug}/`,
		'smallweb.json': {
			crons: [{ schedule: node.cron, args: ['run'] }],
		},
		mainTs: [
			`// ${node.slug}/main.ts — Tidelane node ${node.index}`,
			`// Moon: cycle ${node.moon.cycle} (${node.moon.verb} / ${node.moon.domain})`,
			`// Phase: ${node.phase.name} (${node.phase.timezone}, ${node.phase.utcBand})`,
			`// w3w: ${node.w3w}`,
			'',
			'export default {',
			'  fetch(req: Request) {',
			'    const url = new URL(req.url);',
			'    if (url.pathname === "/mcp") return handleMCP(req);',
			'    return new Response(JSON.stringify({',
			`      node: "${node.slug}",`,
			`      w3w: "${node.w3w}",`,
			`      cycle: ${node.moon.cycle},`,
			`      phase: "${node.phase.name}",`,
			`      timezone: "${node.phase.timezone}",`,
			'    }), { headers: { "content-type": "application/json" } });',
			'  },',
			'  run(args: string[]) {',
			'    // cron entrypoint: dispatch work for this tidelane',
			`    console.log("[${node.slug}] cron fired:", args);`,
			'  },',
			'};',
		].join('\n'),
	}));
}

export function toLinearProjects(nodes: readonly TidelaneNode[]) {
	const seen = new Set<string>();

	return nodes
		.filter((node) => {
			if (seen.has(node.w3w)) {
				return false;
			}

			seen.add(node.w3w);
			return true;
		})
		.map((node) => ({
			name: node.w3w,
			description: [
				`**Cycle ${node.moon.cycle}** — ${node.moon.verb} / ${node.moon.domain}`,
				'',
				'Tidelane project. Three phase nodes:',
				...TIDELANE_PHASES.map((phase) => {
					const phaseShort =
						phase.timezone === 'Americas' ? 'amer' : phase.timezone.toLowerCase();
					return `- **${phase.name}** (${phase.timezone}): \`${node.w3w.split('.')[0]}-${phaseShort}\``;
				}),
			].join('\n'),
		}));
}

export function toOverlapTable(nodes: readonly TidelaneNode[]) {
	const header =
		'| Cycle | Verb | w3w Address | APAC (Waxing) | EMEA (Full) | Americas (Waning) |';
	const separator =
		'|-------|------|-------------|---------------|-------------|-------------------|';
	const rows = [];

	for (let cycle = 1; cycle <= VERBS.length; cycle++) {
		const moonNodes = nodes.filter((node) => node.moon.cycle === cycle);
		const apac = moonNodes.find((node) => node.phase.timezone === 'APAC');
		const emea = moonNodes.find((node) => node.phase.timezone === 'EMEA');
		const amer = moonNodes.find((node) => node.phase.timezone === 'Americas');

		if (!apac || !emea || !amer) {
			throw new Error(`Missing phase coverage for cycle ${cycle}`);
		}

		rows.push(
			`| ${cycle} | ${apac.moon.verb} | ${apac.w3w} | \`${apac.slug}\` ${apac.cron} | \`${emea.slug}\` ${emea.cron} | \`${amer.slug}\` ${amer.cron} |`,
		);
	}

	return [header, separator, ...rows].join('\n');
}
