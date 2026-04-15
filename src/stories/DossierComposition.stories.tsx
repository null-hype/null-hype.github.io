import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import AnalystCallout from '../components/AnalystCallout';
import CaseNode from '../components/CaseNode';
import EpistemicFrame from '../components/EpistemicFrame';
import EvidenceCard from '../components/EvidenceCard';
import InlineFigure from '../components/InlineFigure';
import PullQuote from '../components/PullQuote';
import SectionBreak from '../components/SectionBreak';
import { EditorialTopbar } from '../components/EditorialTopbar';
import { EditorialSidebar } from '../components/EditorialSidebar';
import { ArchiveSection } from '../components/ArchiveSection';
import { ComparisonNotesSection } from '../components/ComparisonNotesSection';
import { SynthesisSection } from '../components/SynthesisSection';
import { EditorialFooter } from '../components/EditorialFooter';

import {
	analystCalloutContent,
	archiveEntries,
	caseNodes,
	caseSectionContent,
	comparisonNotes,
	epistemicFrameContent,
	evidenceCards,
	footerLinks,
	inlineFigureContent,
	leadParagraphs,
	pullQuoteContent,
	sectionBreakContent,
	sideRailItems,
	synthesisContent,
	topNavItems,
	watchlistContent,
} from '../data/editorialContent';

/**
 * DossierComposition is the *argument-assembly* story arc. Each step adds
 * exactly one more component to the dossier — you watch the PLAN-26 v3.5
 * essay get built one beat at a time. By the final step the layout is
 * byte-identical to /dossier on the Astro site.
 *
 * Use this to:
 * - Verify the visual rhythm of the editorial composition
 * - Demo the "build an argument" reading of the component library
 * - Catch regressions between individual component stories and their
 *   final composed context
 */

type StepFlags = {
	frame?: boolean;
	figure?: boolean;
	lead?: boolean;
	caseIntro?: boolean;
	node1?: boolean;
	pullQuote?: boolean;
	node2?: boolean;
	evidenceGrid?: boolean;
	analystCallout?: boolean;
	node3?: boolean;
	node4?: boolean;
	sectionBreak?: boolean;
	archive?: boolean;
	comparisonNotes?: boolean;
	synthesis?: boolean;
	watchlist?: boolean;
};

const DossierStep = ({ steps }: { steps: StepFlags }) => (
	<div className="editorial-page">
		<div className="editorial-grain" aria-hidden="true" />

		<EditorialTopbar navItems={topNavItems} />
		<EditorialSidebar navItems={sideRailItems} />

		<main className="editorial-main">
			{steps.frame ? (
				<section id="epistemic" className="editorial-section editorial-section--bordered">
					<div className="editorial-container">
						<EpistemicFrame {...epistemicFrameContent} />
					</div>
				</section>
			) : null}

			{steps.figure ? (
				<div className="editorial-block">
					<div className="editorial-container">
						<InlineFigure {...inlineFigureContent} />
					</div>
				</div>
			) : null}

			{steps.lead ? (
				<div className="editorial-block editorial-block--tight">
					<div className="editorial-container editorial-prose editorial-prose--lead">
						{leadParagraphs.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
					</div>
				</div>
			) : null}

			{steps.caseIntro || steps.node1 || steps.node2 || steps.node3 || steps.node4 ? (
				<section id="cases" className="editorial-section">
					<div className="editorial-container">
						{steps.caseIntro ? (
							<>
								<header className="editorial-section-heading">
									<h2 className="editorial-section-heading__title">
										{caseSectionContent.title}
									</h2>
									<p className="editorial-section-heading__eyebrow">
										{caseSectionContent.eyebrow}
									</p>
								</header>
								<div className="editorial-prose editorial-prose--case-intro">
									{caseSectionContent.paragraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
								</div>
							</>
						) : null}

						<div className="editorial-case-stack">
							{steps.node1 ? <CaseNode {...caseNodes[0]} /> : null}
							{steps.pullQuote ? <PullQuote {...pullQuoteContent} /> : null}
							{steps.node2 ? <CaseNode {...caseNodes[1]} /> : null}
							{steps.evidenceGrid ? (
								<div className="evidence-grid">
									{evidenceCards.map((card) => (
										<EvidenceCard key={card.label} {...card} />
									))}
								</div>
							) : null}
							{steps.analystCallout ? (
								<AnalystCallout {...analystCalloutContent} />
							) : null}
							{steps.node3 ? <CaseNode {...caseNodes[2]} /> : null}
							{steps.node4 ? <CaseNode {...caseNodes[3]} /> : null}
						</div>
					</div>
				</section>
			) : null}

			{steps.sectionBreak ? (
				<div id="comparisons" className="editorial-section-break-wrap">
					<div className="editorial-container">
						<SectionBreak {...sectionBreakContent} />
					</div>
				</div>
			) : null}

			{steps.archive ? <ArchiveSection entries={archiveEntries} /> : null}

			{steps.comparisonNotes ? <ComparisonNotesSection notes={comparisonNotes} /> : null}

			{steps.synthesis || steps.watchlist ? (
				<SynthesisSection
					synthesisContent={steps.synthesis ? synthesisContent : undefined}
					watchlistContent={steps.watchlist ? watchlistContent : undefined}
				/>
			) : null}
		</main>

		{steps.watchlist ? <EditorialFooter links={footerLinks} /> : null}
	</div>
);

const meta = {
	title: 'Dossier/Composition',
	component: DossierStep,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof DossierStep>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Step 01 — The epistemic frame alone. The essay has not started yet;
 * what the reader sees is only the contract: boundary conditions, the
 * thesis, the flags telling them how strong a claim is coming.
 */
export const Step01_Frame: Story = {
	args: { steps: { frame: true } },
};

/**
 * Step 02 — + InlineFigure. The visual anchor for the four-node sequence
 * arrives before any prose about the nodes.
 */
export const Step02_FramePlusFigure: Story = {
	args: { steps: { frame: true, figure: true } },
};

/**
 * Step 03 — + lead paragraphs. The four nodes are named for the first
 * time (Assad, Valdai, Maduro, Khamenei), still in plain prose.
 */
export const Step03_WithLead: Story = {
	args: { steps: { frame: true, figure: true, lead: true } },
};

/**
 * Step 04 — + case section intro + Node 01 (Assad). The first hard
 * rupture. The reader now has one structured node to anchor the sequence.
 */
export const Step04_FirstNode: Story = {
	args: {
		steps: { frame: true, figure: true, lead: true, caseIntro: true, node1: true },
	},
};

/**
 * Step 05 — + PullQuote. The operational patch lands between the first
 * two nodes: "does not need to be centrally authored to become
 * geopolitically real." This is the reframing beat.
 */
export const Step05_WithPullQuote: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
		},
	},
};

/**
 * Step 06 — + Node 02 (Valdai). The weak node enters the sequence,
 * marked as contested. The essay is now forced to be honest about
 * evidentiary unevenness.
 */
export const Step06_WithSecondNode: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
		},
	},
};

/**
 * Step 07 — + EvidenceCard grid. Three cards: compression metric, method
 * quote, claim ladder. The argument starts quantifying itself.
 */
export const Step07_WithEvidenceGrid: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
			evidenceGrid: true,
		},
	},
};

/**
 * Step 08 — + AnalystCallout. "Weak node discipline" — the essay names
 * the Valdai problem explicitly rather than letting the reader discover
 * it.
 */
export const Step08_WithAnalystCallout: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
			evidenceGrid: true,
			analystCallout: true,
		},
	},
};

/**
 * Step 09 — + Nodes 03 (Maduro) and 04 (Khamenei). The full four-node
 * sequence is now on the page. The "pattern" is visible in its entirety
 * for the first time.
 */
export const Step09_FullCaseSequence: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
			evidenceGrid: true,
			analystCallout: true,
			node3: true,
			node4: true,
		},
	},
};

/**
 * Step 10 — + SectionBreak. The "Comparative Tests" pivot. The argument
 * stops describing and starts submitting itself for testing.
 */
export const Step10_WithComparativeBreak: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
			evidenceGrid: true,
			analystCallout: true,
			node3: true,
			node4: true,
			sectionBreak: true,
		},
	},
};

/**
 * Step 11 — + ArchiveEntry list + comparison notes. Historical baselines
 * and warning labels (Iraq 2003, Beirut-to-Grenada, aluminium tubes,
 * prediction markets) enter the dossier.
 */
export const Step11_WithArchive: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
			evidenceGrid: true,
			analystCallout: true,
			node3: true,
			node4: true,
			sectionBreak: true,
			archive: true,
			comparisonNotes: true,
		},
	},
};

/**
 * Step 12 — + synthesis copy + WatchlistPanel + footer. The full dossier.
 * This story should render byte-identically to /dossier on the Astro
 * site. It is the terminal step of the argument arc.
 */
export const Step12_FullDossier: Story = {
	args: {
		steps: {
			frame: true,
			figure: true,
			lead: true,
			caseIntro: true,
			node1: true,
			pullQuote: true,
			node2: true,
			evidenceGrid: true,
			analystCallout: true,
			node3: true,
			node4: true,
			sectionBreak: true,
			archive: true,
			comparisonNotes: true,
			synthesis: true,
			watchlist: true,
		},
	},
};
