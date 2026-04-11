import React from 'react';

import AnalystCallout from './AnalystCallout';
import ArchiveEntry from './ArchiveEntry';
import SectionBreak from './SectionBreak';
import TidelaneList, { type TidelaneListSection } from './TidelaneList';
import { RedactionBlock } from './DesignSystemComponents';

export interface NowPageMeta {
	readonly lastUpdated: string;
	readonly title: string;
	readonly intro: readonly string[];
	readonly footer: string;
}

export interface NowPageViewProps {
	readonly meta: NowPageMeta;
	readonly sections: readonly TidelaneListSection[];
	readonly warning?: string;
	readonly isFavorited?: boolean;
}

function toIdFragment(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function JitterTitle({ text }: { text: string }) {
	return (
		<>
			{text.split(' ').map((word, wordIndex) => (
				<span key={wordIndex} className="now-title__word">
					{word.split('').map((char, charIndex) => {
						const jitter = (wordIndex + charIndex) % 7 === 0;
						const dir = (wordIndex + charIndex) % 2 === 0 ? 'up' : 'down';
						return (
							<span
								key={charIndex}
								className={jitter ? `baseline-shift-${dir}` : undefined}
							>
								{char}
							</span>
						);
					})}
					{' '}
				</span>
			))}
		</>
	);
}

export default function NowPageView({
	meta,
	sections,
	warning,
	isFavorited = true,
}: Readonly<NowPageViewProps>) {
	const totalProjects = sections.reduce((sum, section) => sum + section.items.length, 0);
	const totalInitiatives = sections.length;
	const firstSectionId = sections[0]
		? sections[0].id ?? toIdFragment(sections[0].title)
		: 'projects';
	const latestUpdateItem = sections
		.flatMap((section) => section.items)
		.filter((item) => Boolean(item.latestUpdate))
		.sort((a, b) => (b.updatedAtIso ?? '').localeCompare(a.updatedAtIso ?? ''))[0];
	const archiveEntries = sections.map((section, index) => {
		const sectionId = section.id ?? toIdFragment(section.title);
		const itemCount = section.items.length;
		return {
			index: String(index + 1).padStart(3, '0'),
			title: section.title,
			href: `#${sectionId}`,
			archivalId: `${itemCount} ${itemCount === 1 ? 'project' : 'projects'}`,
			status: section.summary ?? '',
			statusTone: (itemCount === 0 ? 'restricted' : 'default') as const,
		};
	});

	return (
		<div className="now-page" data-favorited={isFavorited}>
			<div className="now-page__grain" aria-hidden="true"></div>

			<header className="editorial-topbar">
				<div className="editorial-topbar__inner">
					<div className="editorial-topbar__group">
						<a className="editorial-topbar__brand" href="/now">
							{meta.title}
						</a>
						<nav className="editorial-nav" aria-label="Project groups">
							{sections.map((section) => {
								const sectionId = section.id ?? toIdFragment(section.title);
								return (
									<a key={sectionId} href={`#${sectionId}`}>
										{section.title}
									</a>
								);
							})}
						</nav>
					</div>

					<div className="editorial-topbar__actions">
						<a className="editorial-pdf-link" href={`#${firstSectionId}`}>
							{meta.footer}
						</a>
					</div>
				</div>
			</header>

			<main className="editorial-main">
				<div className="editorial-section-break-wrap">
					<div className="editorial-container">
						<SectionBreak
							title={meta.title}
							eyebrow={meta.lastUpdated || meta.footer}
							meta={`${totalProjects} active // ${totalInitiatives} initiatives`}
						/>
					</div>
				</div>

				{warning ? (
					<div className="editorial-block editorial-block--tight">
						<div className="editorial-container">
							<AnalystCallout
								label={meta.lastUpdated || meta.title}
								text={warning}
								tone="dark"
							/>
						</div>
					</div>
				) : latestUpdateItem?.latestUpdate ? (
					<div className="editorial-block editorial-block--tight">
						<div className="editorial-container">
							<AnalystCallout
								label={`${latestUpdateItem.projectId} // ${latestUpdateItem.updatedAt ?? meta.lastUpdated}`}
								text={latestUpdateItem.latestUpdate}
							/>
						</div>
					</div>
				) : null}

				{archiveEntries.length > 0 ? (
					<section className="editorial-section archive-section">
						<div className="editorial-container archive-section__grid">
							<div className="archive-section__intro">
								<h2 className="archive-section__title">{meta.title}</h2>
								<p className="archive-section__eyebrow">{meta.footer}</p>
							</div>

							<div className="archive-section__list now-archive-list">
								{archiveEntries.map((entry) => (
									<ArchiveEntry key={entry.href} {...entry} />
								))}
							</div>
						</div>
					</section>
				) : null}

				<section className="editorial-section">
					<div className="editorial-container now-board-wrap">
						<header className="now-page__header">
							{meta.lastUpdated ? (
								<p className="now-kicker">
									<RedactionBlock text={meta.lastUpdated} />
								</p>
							) : null}
							<h1 className="now-title">
								<JitterTitle text={meta.title} />
							</h1>
						</header>

						<TidelaneList sections={sections} />
					</div>
				</section>
			</main>
		</div>
	);
}
