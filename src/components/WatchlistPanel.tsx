import React from 'react';

export interface WatchlistPanelProps {
	readonly eyebrow: string;
	readonly version: string;
	readonly title: string;
	readonly indicators: readonly {
		readonly label: string;
		readonly title: string;
		readonly description: string;
	}[];
	readonly ctaLabel: string;
	readonly dossierId: string;
}

export default function WatchlistPanel({
	eyebrow,
	version,
	title,
	indicators,
	ctaLabel,
	dossierId,
}: Readonly<WatchlistPanelProps>) {
	return (
		<aside className="watchlist-panel">
			<div className="watchlist-panel__header">
				<span className="watchlist-panel__eyebrow">{eyebrow}</span>
				<span className="watchlist-panel__version">{version}</span>
			</div>
			<h3 className="watchlist-panel__title">{title}</h3>
			<ul className="watchlist-panel__list">
				{indicators.map((indicator) => (
					<li key={indicator.label} className="watchlist-panel__item">
						<span className="watchlist-panel__indicator-label">{indicator.label}</span>
						<p className="watchlist-panel__item-title">{indicator.title}</p>
						<p className="watchlist-panel__item-copy">{indicator.description}</p>
					</li>
				))}
			</ul>
			<div className="watchlist-panel__footer">
				<button className="watchlist-panel__cta" type="button">
					{ctaLabel}
				</button>
				<p className="watchlist-panel__dossier">{dossierId}</p>
			</div>
		</aside>
	);
}
