import React from 'react';

export interface TidelaneListItem {
	readonly title: string;
	readonly body: string;
	readonly href?: string;
	readonly projectId: string;
	readonly status: string;
	readonly issueCount: number;
	readonly priority?: string;
	readonly updatedAt?: string;
	readonly updatedAtIso?: string;
	readonly latestUpdate?: string;
}

export interface TidelaneListSection {
	readonly id?: string;
	readonly title: string;
	readonly summary?: string;
	readonly emptyMessage?: string;
	readonly items: readonly TidelaneListItem[];
}

export interface TidelaneListProps {
	readonly sections: readonly TidelaneListSection[];
}

function toIdFragment(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function TidelaneCard({ item }: Readonly<{ item: TidelaneListItem }>) {
	const entryLabel = item.issueCount === 1 ? 'entry' : 'entries';

	return (
		<article className="tidelane-card">
			<div className="tidelane-card__header">
				<p className="tidelane-card__status">{item.status}</p>
				{item.updatedAt ? <p className="tidelane-card__updated">{item.updatedAt}</p> : null}
			</div>

			<div className="tidelane-card__content">
				{item.href ? (
					<a href={item.href} className="tidelane-card__title-link">
						<h3 className="tidelane-card__title">{item.title}</h3>
					</a>
				) : (
					<h3 className="tidelane-card__title">{item.title}</h3>
				)}

				{item.body ? (
					<div className="tidelane-card__body-wrap">
						<p className="tidelane-card__body">{item.body}</p>
					</div>
				) : null}

				{item.latestUpdate ? (
					<p className="tidelane-card__update">{item.latestUpdate}</p>
				) : null}
			</div>

			<div className="tidelane-card__meta">
				<p className="tidelane-card__meta-item">{item.projectId}</p>
				<p className="tidelane-card__meta-item">
					{item.issueCount} {entryLabel}
				</p>
				{item.priority ? (
					<p className="tidelane-card__meta-item">{item.priority}</p>
				) : null}
			</div>
		</article>
	);
}

export default function TidelaneList({ sections }: Readonly<TidelaneListProps>) {
	return (
		<div className="tidelane-board">
			{sections.map((section) => {
				const id = section.id ?? toIdFragment(section.title);
				const headingId = `${id}-heading`;

				return (
					<section key={id} className="now-section tidelane-section" id={id} aria-labelledby={headingId}>
						<div className="tidelane-section__header">
							<h2 id={headingId}>{section.title}</h2>
							{section.summary ? (
								<p className="tidelane-section__summary">{section.summary}</p>
							) : null}
						</div>

						{section.items.length > 0 ? (
							<ul className="tidelane-list">
								{section.items.map((item) => (
									<li key={`${id}-${item.projectId}`} className="tidelane-list__item">
										<TidelaneCard item={item} />
									</li>
								))}
							</ul>
						) : section.emptyMessage ? (
							<p className="tidelane-section__empty">{section.emptyMessage}</p>
						) : null}
					</section>
				);
			})}
		</div>
	);
}
