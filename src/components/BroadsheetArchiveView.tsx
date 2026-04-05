import React from 'react';

import BroadsheetArchiveEntry, { type BroadsheetArchiveEntryProps } from './BroadsheetArchiveEntry';

export interface BroadsheetArchiveViewProps {
	readonly masthead: string;
	readonly reference: string;
	readonly sideNav: readonly {
		readonly label: string;
		readonly active?: boolean;
	}[];
	readonly noteEyebrow: string;
	readonly noteTitle: string;
	readonly noteParagraphs: readonly string[];
	readonly figureLabel: string;
	readonly entries: readonly BroadsheetArchiveEntryProps[];
	readonly stats: readonly {
		readonly label: string;
		readonly value: string;
	}[];
}

export default function BroadsheetArchiveView({
	masthead,
	reference,
	sideNav,
	noteEyebrow,
	noteTitle,
	noteParagraphs,
	figureLabel,
	entries,
	stats,
}: Readonly<BroadsheetArchiveViewProps>) {
	return (
		<section className="broadsheet-page broadsheet-archive-view">
			<div className="broadsheet-page__system-bar">
				<span>Node: Archive Prime</span>
				<span>Status: Encrypted Stream</span>
				<span>Latency: 14ms</span>
			</div>
			<div className="broadsheet-page__shell">
				<aside className="broadsheet-page__sidebar" aria-label="Archive navigation">
					<h2 className="broadsheet-page__sidebar-title">Archival Index</h2>
					<p className="broadsheet-page__sidebar-ref">V.0824-2023</p>
					<nav className="broadsheet-page__sidebar-nav">
						{sideNav.map((item) => (
							<a
								key={item.label}
								className="broadsheet-page__sidebar-link"
								data-active={item.active ? 'true' : 'false'}
								href="#"
							>
								{item.label}
							</a>
						))}
					</nav>
				</aside>
				<div className="broadsheet-page__content">
					<header className="broadsheet-page__masthead">
						<div>
							<p className="broadsheet-page__eyebrow">{reference}</p>
							<h1 className="broadsheet-page__title">{masthead}</h1>
						</div>
						<nav className="broadsheet-page__tabs" aria-label="Archive tabs">
							<a href="#" data-active="true">
								Archive
							</a>
							<a href="#">Coordinates</a>
							<a href="#">Metadata</a>
						</nav>
					</header>

					<div className="broadsheet-archive-view__lead">
						<article className="broadsheet-note-card">
							<p className="broadsheet-note-card__eyebrow">{noteEyebrow}</p>
							<h2 className="broadsheet-note-card__title">{noteTitle}</h2>
							<div className="broadsheet-note-card__copy">
								{noteParagraphs.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</div>
						</article>
						<div className="broadsheet-hero-plate">
							<div className="broadsheet-hero-plate__graphic" aria-hidden="true" />
							<span className="broadsheet-hero-plate__label">{figureLabel}</span>
						</div>
					</div>

					<div className="broadsheet-page__section-heading">
						<h2>Archive Entries</h2>
						<span>Displaying 001-007 of 944</span>
					</div>
					<div className="broadsheet-archive-view__grid">
						{entries.map((entry) => (
							<BroadsheetArchiveEntry key={entry.index} {...entry} />
						))}
					</div>

					<footer className="broadsheet-page__footer">
						<div className="broadsheet-page__footer-copy">
							<h3>{masthead}</h3>
							<p>
								A publication system for studying hidden intent, planted signals, and the
								moments when structure becomes visible.
							</p>
						</div>
						<ul className="broadsheet-page__footer-stats">
							{stats.map((stat) => (
								<li key={stat.label}>
									<span>{stat.label}</span>
									<strong>{stat.value}</strong>
								</li>
							))}
						</ul>
					</footer>
				</div>
			</div>
		</section>
	);
}
