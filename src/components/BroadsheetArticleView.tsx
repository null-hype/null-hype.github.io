import React from 'react';

import FieldNoteCard, { type FieldNoteCardProps } from './FieldNoteCard';
import InlineFigure, { type InlineFigureProps } from './InlineFigure';
import PullQuote, { type PullQuoteProps } from './PullQuote';

export interface BroadsheetArticleViewProps {
	readonly masthead: string;
	readonly railItems: readonly string[];
	readonly metadata: readonly {
		readonly label: string;
		readonly value: string;
	}[];
	readonly title: string;
	readonly deck: string;
	readonly sections: readonly {
		readonly heading: string;
		readonly paragraphs: readonly string[];
	}[];
	readonly pullQuote: Readonly<PullQuoteProps>;
	readonly figure: Readonly<InlineFigureProps>;
	readonly fieldNotes: readonly Readonly<FieldNoteCardProps>[];
	readonly previousEntry: {
		readonly title: string;
		readonly description: string;
		readonly href: string;
	};
	readonly nextEntry: {
		readonly title: string;
		readonly description: string;
		readonly href: string;
	};
}

export default function BroadsheetArticleView({
	masthead,
	railItems,
	metadata,
	title,
	deck,
	sections,
	pullQuote,
	figure,
	fieldNotes,
	previousEntry,
	nextEntry,
}: Readonly<BroadsheetArticleViewProps>) {
	return (
		<section className="broadsheet-page broadsheet-article-view">
			<header className="broadsheet-page__masthead broadsheet-page__masthead--compact">
				<div>
					<p className="broadsheet-page__eyebrow">The Archival Monograph</p>
					<h1 className="broadsheet-page__title broadsheet-page__title--compact">{masthead}</h1>
				</div>
				<nav className="broadsheet-page__tabs" aria-label="Article navigation">
					<a href="#" data-active="true">
						Archive
					</a>
					<a href="#">Intelligence</a>
					<a href="#">Dispatch</a>
				</nav>
			</header>

			<div className="broadsheet-article-view__shell">
				<aside className="broadsheet-article-view__rail" aria-label="Article taxonomy">
					<p className="broadsheet-page__eyebrow">Taxonomy</p>
					<nav className="broadsheet-article-view__rail-nav" aria-label="Article rail sections">
						{railItems.map((item, index) => (
							<a key={item} href="#" data-active={index === 0 ? 'true' : 'false'}>
								{item}
							</a>
						))}
					</nav>
				</aside>

				<div className="broadsheet-article-view__body">
					<div className="broadsheet-article-view__meta">
						{metadata.map((item) => (
							<div key={item.label} className="broadsheet-article-view__meta-item">
								<span>{item.label}</span>
								<strong>{item.value}</strong>
							</div>
						))}
					</div>

					<header className="broadsheet-article-view__header">
						<h2>{title}</h2>
						<p>{deck}</p>
					</header>

					<div className="broadsheet-article-view__content">
						<article className="broadsheet-article-view__copy">
							{sections.map((section, index) => (
								<div key={section.heading} className="broadsheet-article-view__section">
									<h3>{section.heading}</h3>
									{section.paragraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
									{index === 0 ? <PullQuote {...pullQuote} /> : null}
									{index === 1 ? <InlineFigure {...figure} /> : null}
								</div>
							))}
						</article>

						<aside className="broadsheet-article-view__notes">
							{fieldNotes.map((note) => (
								<FieldNoteCard key={note.reference} {...note} />
							))}
							<div className="broadsheet-article-view__asset" aria-hidden="true" />
						</aside>
					</div>

					<nav className="broadsheet-article-view__adjacency" aria-label="Adjacent article entries">
						<a href={previousEntry.href}>
							<span>Previous Entry</span>
							<strong>{previousEntry.title}</strong>
							<em>{previousEntry.description}</em>
						</a>
						<a href={nextEntry.href}>
							<span>Next Entry</span>
							<strong>{nextEntry.title}</strong>
							<em>{nextEntry.description}</em>
						</a>
					</nav>
				</div>
			</div>
		</section>
	);
}
