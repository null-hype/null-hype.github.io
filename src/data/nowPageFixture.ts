import type { ProjectLandingItem, ProjectLandingSectionData } from '../components/ProjectLandingSection';
import type { NowPageData } from './nowPageData';
import { createUnavailableNowPageData } from './nowPageData';

export const australianMcpFieldNotesDigest: ProjectLandingItem = {
	title: 'Australian MCP Field Notes',
	body: 'Public field notes and dispatches on the emerging Australian MCP and agentic infrastructure scene, derived from LinkedIn reconnaissance and production work.',
	href: '/projects/australian-mcp-field-notes',
	projectId: '2861F9CC',
	status: 'In Progress',
	issueCount: 5,
	priority: 'High',
	updatedAt: 'April 2, 2026',
	updatedAtIso: '2026-04-02T20:28:46.000Z',
	latestUpdate:
		'I spent two weeks mapping the Australian MCP and agentic AI scene — who is building, who is hiring, and where the gaps are between what companies need and what job titles say.',
};

export const sixDomainsOneStackDigest: ProjectLandingItem = {
	title: 'Six Domains, One Stack',
	body: 'The Grammar as Protocol thesis applied across six domains — SAT math, German grammar, music theory, security scanning, operational scheduling, and argumentation — showing the same four-layer architecture in each.',
	href: '/projects/six-domains-one-stack',
	projectId: '4741BDC2',
	status: 'In Progress',
	issueCount: 2,
	priority: 'High',
	updatedAt: 'April 3, 2026',
	updatedAtIso: '2026-04-03T04:19:32.770Z',
	latestUpdate:
		'Grammars are compiled expertise. An expensive model writes the rules once. A cheap model enforces them forever.',
};

export const confirmedFindingsDigest: ProjectLandingItem = {
	title: 'Confirmed Findings',
	body: 'Vulnerability disclosures from production security research — confirmed, responsibly disclosed, and written up for a technical audience.',
	href: '/projects/confirmed-findings',
	projectId: '78EA8AFA',
	status: 'In Progress',
	issueCount: 1,
	priority: 'High',
	updatedAt: 'April 8, 2026',
	updatedAtIso: '2026-04-08T03:05:24.512Z',
	latestUpdate:
		'We are currently waiting for WeWork to respond regarding the inactive accounts password reset issue.',
};

export const buildingTidelandsDigest: ProjectLandingItem = {
	title: 'Building tidelands.dev',
	body: 'How tidelands.dev went from an empty domain to a deployed smallweb origin with Terraform, Dagger, and Cloudflare — and why the decision log matters more than the code.',
	href: '/projects/building-tidelands-dev',
	projectId: 'C24E45B0',
	status: 'In Progress',
	issueCount: 3,
	priority: 'High',
	updatedAt: 'April 3, 2026',
	updatedAtIso: '2026-04-03T04:18:08.896Z',
	latestUpdate:
		'tidelands.dev started as an empty domain and a constraint: no manual SSH, no console clicks, one command to deploy everything.',
};

export const cyberFarmDispatchesSection: ProjectLandingSectionData = {
	id: 'the-cyber-farm-dispatches',
	title: 'The Cyber Farm Dispatches',
	items: [australianMcpFieldNotesDigest],
};

export const grammarAsProtocolSection: ProjectLandingSectionData = {
	id: 'grammar-as-protocol',
	title: 'Grammar as Protocol',
	items: [sixDomainsOneStackDigest],
};

export const securityResearchSection: ProjectLandingSectionData = {
	id: 'security-research',
	title: 'Security Research',
	items: [confirmedFindingsDigest],
};

export const infrastructureSection: ProjectLandingSectionData = {
	id: 'infrastructure',
	title: 'Infrastructure',
	items: [buildingTidelandsDigest],
};

export const mockNowPageData: NowPageData = {
	meta: {
		lastUpdated: 'April 8, 2026',
		title: 'Projects',
		intro: [],
		footer: '4 in-progress projects',
	},
	sections: [
		cyberFarmDispatchesSection,
		grammarAsProtocolSection,
		securityResearchSection,
		infrastructureSection,
	] satisfies readonly ProjectLandingSectionData[],
	isFavorited: true,
};

export const mockUnavailableNowPageData = createUnavailableNowPageData();
