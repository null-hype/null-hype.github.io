/**
 * tidelane-gen.ts
 *
 * Generates 39 tidelane node definitions from:
 *   13 moons (cycle identity: team/verb/domain)
 *   × 3 timezone phases (APAC, EMEA, Americas)
 *
 * Each node gets:
 *   - A smallweb-safe slug (folder name / subdomain)
 *   - A w3w-style address (three.random.words) as the Linear project name
 *   - Moon metadata (cycle number, verb, domain)
 *   - Phase metadata (timezone, UTC offset band, cron schedule)
 *
 * Usage:
 *   deno run tidelane-gen.ts              # print JSON to stdout
 *   deno run tidelane-gen.ts --seed=42    # deterministic output
 *   deno run tidelane-gen.ts --smallweb   # emit smallweb.json cron entries
 *   deno run tidelane-gen.ts --linear     # emit Linear project creation script
 *
 * The generation logic now lives in `src/data/tidelane.ts` so the site
 * and Storybook can reuse the same node model.
 */

import {
	generateTidelaneNodes,
	toLinearProjects,
	toOverlapTable,
	toSmallwebApps,
	toSmallwebJson,
} from './src/data/tidelane.ts';

const args = typeof Deno !== 'undefined' ? Deno.args : process.argv.slice(2);
const seedFlag = args.find((arg) => arg.startsWith('--seed='));
const seed = seedFlag ? Number.parseInt(seedFlag.split('=')[1], 10) : Date.now();
const nodes = generateTidelaneNodes(seed);

if (args.includes('--smallweb')) {
	console.log(JSON.stringify(toSmallwebJson(nodes), null, 2));
} else if (args.includes('--smallweb-apps')) {
	console.log(JSON.stringify(toSmallwebApps(nodes), null, 2));
} else if (args.includes('--linear')) {
	console.log(JSON.stringify(toLinearProjects(nodes), null, 2));
} else if (args.includes('--table')) {
	console.log(toOverlapTable(nodes));
} else {
	console.log(`# Tidelane Nodes (seed: ${seed})\n`);
	console.log(toOverlapTable(nodes));
	console.log('\n---\n');
	console.log('## Smallweb cron entries:\n');
	console.log(JSON.stringify(toSmallwebJson(nodes), null, 2));
	console.log('\n## Linear projects (13, one per moon):\n');
	console.log(JSON.stringify(toLinearProjects(nodes), null, 2));
}
