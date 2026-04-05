import React from 'react';

import BroadsheetStamp, { type BroadsheetStampProps } from './BroadsheetStamp';

export interface BroadsheetDispatchViewProps {
	readonly masthead: string;
	readonly series: string;
	readonly issue: string;
	readonly stamps: readonly Readonly<BroadsheetStampProps>[];
	readonly title: string;
	readonly author: string;
	readonly timestamp: string;
	readonly thesis: string;
	readonly observations: readonly {
		readonly index: string;
		readonly title: string;
		readonly body: string;
		readonly offset?: boolean;
	}[];
	readonly quote: string;
	readonly citation: string;
	readonly links: readonly {
		readonly label: string;
		readonly href: string;
		readonly subdued?: boolean;
	}[];
}

export default function BroadsheetDispatchView({
	masthead,
	series,
	issue,
	stamps,
	title,
	author,
	timestamp,
	thesis,
	observations,
	quote,
	citation,
	links,
}: Readonly<BroadsheetDispatchViewProps>) {
	return (
		<section className="broadsheet-dispatch-view">
			<header className="broadsheet-dispatch-view__topbar">
				<span>{masthead}</span>
				<span>Search</span>
			</header>

			<div className="broadsheet-dispatch-view__status">
				<div className="broadsheet-dispatch-view__stamps">
					{stamps.map((stamp) => (
						<BroadsheetStamp key={`${stamp.label}:${stamp.value}`} {...stamp} />
					))}
				</div>
			</div>

			<div className="broadsheet-dispatch-view__body">
				<p className="broadsheet-dispatch-view__eyebrow">
					{series} // {issue}
				</p>
				<h2 className="broadsheet-dispatch-view__title">{title}</h2>

				<div className="broadsheet-dispatch-view__byline">
					<div>
						<span>Author</span>
						<strong>{author}</strong>
					</div>
					<div>
						<span>Timestamp</span>
						<strong>{timestamp}</strong>
					</div>
				</div>

				<div className="broadsheet-dispatch-view__figure">
					<div className="broadsheet-dispatch-view__figure-plate" aria-hidden="true" />
					<span>Fig 1.1: The archetypal found object</span>
				</div>

				<p className="broadsheet-dispatch-view__thesis">{thesis}</p>

				<ol className="broadsheet-dispatch-view__observations">
					{observations.map((observation) => (
						<li
							key={observation.index}
							className="broadsheet-dispatch-view__observation"
							data-offset={observation.offset ? 'true' : 'false'}
						>
							<span>{observation.index}</span>
							<div>
								<h3>{observation.title}</h3>
								<p>{observation.body}</p>
							</div>
						</li>
					))}
				</ol>

				<blockquote className="broadsheet-dispatch-view__quote">
					<p>{quote}</p>
					<cite>{citation}</cite>
				</blockquote>

				<nav className="broadsheet-dispatch-view__links">
					{links.map((link) => (
						<a key={link.label} href={link.href} data-subdued={link.subdued ? 'true' : 'false'}>
							{link.label}
						</a>
					))}
				</nav>
			</div>
		</section>
	);
}
