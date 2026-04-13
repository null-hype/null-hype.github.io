import React from 'react';

import SectionBreak from './SectionBreak';
import TidelaneList from './TidelaneList';
import { type ProjectLandingSectionData } from './ProjectLandingSection';

export interface NowPageMeta {
	readonly lastUpdated: string;
	readonly title: string;
	readonly intro: readonly string[];
	readonly footer: string;
}

export interface NowPageViewProps {
	readonly meta: NowPageMeta;
	readonly sections: readonly ProjectLandingSectionData[];
	readonly warning?: string;
	readonly isFavorited?: boolean;
}

function toIdFragment(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

	return (
		<div className="now-page" data-favorited={isFavorited}>
			<div className="now-page__grain" aria-hidden="true"></div>

			<header className="editorial-topbar">
				<div className="editorial-topbar__inner">
					<div className="editorial-topbar__group">
						<a className="editorial-topbar__brand" href="/">
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
						<a className="editorial-pdf-link" href="/broadsheet" style={{ marginRight: '1rem' }}>
							Dispatch
						</a>
						<a className="editorial-pdf-link" href={`#${firstSectionId}`}>
							Browse
						</a>
					</div>
				</div>
			</header>

			<main className="editorial-main">
				<div className="editorial-section-break-wrap">
					<div className="editorial-container">
						<SectionBreak
							title={meta.title}
							eyebrow={meta.lastUpdated || 'Active project index'}
							meta={`${totalProjects} active // ${totalInitiatives} initiatives`}
						/>
					</div>
				</div>

				{warning ? (
					<div className="editorial-block editorial-block--tight">
						<div className="editorial-container editorial-prose">
							<p className="project-landing__warning">{warning}</p>
						</div>
					</div>
				) : null}

				{meta.intro.length > 0 ? (
					<div className="editorial-block editorial-block--tight">
						<div className="editorial-container editorial-prose editorial-prose--lead">
							{meta.intro.map((paragraph) => (
								<p key={paragraph}>{paragraph}</p>
							))}
						</div>
					</div>
				) : null}

				<section className="editorial-section project-landing">
					<div className="editorial-container">
						<TidelaneList sections={sections} />
					</div>
				</section>
			</main>
		</div>
	);
}
