import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import AnalystCallout from '../components/AnalystCallout';
import ArchiveEntry from '../components/ArchiveEntry';
import CaseNode from '../components/CaseNode';
import EpistemicFrame from '../components/EpistemicFrame';
import EvidenceCard from '../components/EvidenceCard';
import InlineFigure from '../components/InlineFigure';
import PullQuote from '../components/PullQuote';
import SectionBreak from '../components/SectionBreak';
import WatchlistPanel from '../components/WatchlistPanel';

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

		<header className="editorial-topbar">
			<div className="editorial-topbar__inner">
				<div className="editorial-topbar__group">
					<a className="editorial-topbar__brand" href="/now">
						jungle.roaring.wave
					</a>
					<nav className="editorial-nav" aria-label="Primary dossier sections">
						{topNavItems.map((item) => (
							<a
								key={item.label}
								href={item.href}
								className={item.active ? 'is-active' : undefined}
							>
								{item.label}
							</a>
						))}
					</nav>
				</div>
				<div className="editorial-topbar__actions">
					<a className="editorial-pdf-link" href="/now">
						Now page
					</a>
				</div>
			</div>
		</header>

		<aside className="editorial-sidebar" aria-label="Dossier shortcuts">
			<div className="editorial-sidebar__inner">
				<div className="editorial-sidebar__brand">
					<span className="editorial-sidebar__brand-mark">JRW</span>
					<span className="editorial-sidebar__ref">Ref: PLAN-26 v3.5</span>
				</div>
				<nav className="editorial-sidebar__nav" aria-label="Section shortcuts">
					{sideRailItems.map((item) => (
						<a
							key={item.label}
							href={item.href}
							className={item.active ? 'is-active' : undefined}
						>
							<span
								className="editorial-sidebar__icon material-symbols-outlined"
								aria-hidden="true"
							>
								{item.icon}
							</span>
							<span>{item.label}</span>
						</a>
					))}
				</nav>
			</div>
		</aside>

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

			{steps.archive ? (
				<section className="editorial-section archive-section">
					<div className="editorial-container archive-section__grid">
						<div className="archive-section__intro">
							<h2 className="archive-section__title">Comparative Baselines</h2>
							<p className="archive-section__eyebrow">
								Historical precedent, red-team warning, forecast layer.
							</p>
							<div className="archive-section__copy">
								<p>
									A sequence like this only becomes durable if it survives comparison. That
									means looking for both historical forms that make it more plausible and
									warning labels that make overreach easier to spot.
								</p>
								<p>
									The goal is not to flatten everything into one chain. The goal is to locate
									where the argument gains traction, where it starts flattering itself, and
									where it can be forced into real questions.
								</p>
							</div>
						</div>
						<div className="archive-section__list">
							{archiveEntries.map((entry) => (
								<ArchiveEntry key={entry.index} {...entry} />
							))}
						</div>
					</div>
				</section>
			) : null}

			{steps.comparisonNotes ? (
				<section className="editorial-section editorial-section--bordered">
					<div className="editorial-container editorial-note-stack">
						{comparisonNotes.map((note) => (
							<article key={note.id} id={note.id} className="editorial-note">
								<h3 className="editorial-note__title">{note.title}</h3>
								<div className="editorial-note__copy">
									{note.paragraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
								</div>
							</article>
						))}
					</div>
				</section>
			) : null}

			{steps.synthesis || steps.watchlist ? (
				<section id="forecast" className="editorial-section">
					<div className="editorial-container synthesis-section__grid">
						{steps.synthesis ? (
							<div className="synthesis-section__copy">
								<h2 className="synthesis-section__title">{synthesisContent.title}</h2>
								<div className="synthesis-copy">
									{synthesisContent.paragraphs.map((paragraph, index) => (
										<p
											key={paragraph}
											className={
												index === synthesisContent.paragraphs.length - 1
													? 'is-muted'
													: undefined
											}
										>
											{paragraph}
										</p>
									))}
								</div>
							</div>
						) : null}
						{steps.watchlist ? (
							<div className="synthesis-section__panel">
								<WatchlistPanel {...watchlistContent} />
							</div>
						) : null}
					</div>
				</section>
			) : null}
		</main>

		{steps.watchlist ? (
			<footer className="editorial-footer">
				<div className="editorial-container editorial-footer__grid">
					<div className="editorial-footer__copy">
						<span className="editorial-footer__brand">jungle.roaring.wave</span>
						<p className="editorial-footer__meta">PLAN-26 v3.5 rendered March 24, 2026.</p>
						<p className="editorial-footer__legal">
							This version treats the sequence as a candidate signal that must survive
							comparison, counterargument, and future scoring before it earns anything
							stronger than disciplined suspicion.
						</p>
					</div>
					<div className="editorial-footer__links">
						{footerLinks.map((link) => (
							<a key={link.label} href={link.href}>
								{link.label}
							</a>
						))}
					</div>
				</div>
			</footer>
		) : null}
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
