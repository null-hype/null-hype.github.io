import React from 'react';

export interface TidelaneListItem {
	readonly title: string;
	readonly body: string;
	readonly references: string;
	readonly lane: {
		readonly slug: string;
		readonly w3w: string;
		readonly moon: {
			readonly cycle: number;
			readonly verb: string;
			readonly domain: string;
		};
		readonly phase: {
			readonly name: 'waxing' | 'full' | 'waning';
			readonly timezone: 'APAC' | 'EMEA' | 'Americas';
			readonly utcBand: string;
		};
	};
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
	const { lane } = item;

	return (
		<article className="tidelane-card" data-phase={lane.phase.name}>
			<div className="tidelane-card__rail">
				<p className="tidelane-card__phase">
					{lane.phase.name} lane / {lane.phase.timezone}
				</p>
				<p className="tidelane-card__slug">ENTRY::{lane.slug}</p>
				<p className="tidelane-card__window">{lane.phase.utcBand}</p>
			</div>

			<div className="tidelane-card__content">
				{item.href ? (
					<a href={item.href} className="tidelane-card__title-link" style={{ textDecoration: 'none', color: 'inherit' }}>
						<h3 className="tidelane-card__title" style={{ textDecoration: 'underline' }}>{item.title}</h3>
					</a>
				) : (
					<h3 className="tidelane-card__title">{item.title}</h3>
				)}
				<div className="tidelane-card__body-wrap">
					<p className="tidelane-card__body">{item.body}</p>
				</div>
			</div>

			<div className="tidelane-card__meta">
				<p className="tidelane-card__track">[{lane.w3w}]</p>
				<p className="tidelane-card__moon">
					Cycle {lane.moon.cycle} // {lane.moon.verb} // {lane.moon.domain}
				</p>
				<p className="tidelane-card__refs">REF: {item.references}</p>
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
				const phase = section.items[0]?.lane.phase.name ?? 'full';

				return (
					<section
						key={id}
						className="now-section tidelane-section"
						id={id}
						aria-labelledby={headingId}
						data-phase={phase}
					>
						<div className="tidelane-section__header">
							<h2 id={headingId}>{section.title}</h2>
							{section.summary ? (
								<p className="tidelane-section__summary">SIGNAL: {section.summary}</p>
							) : null}
						</div>

						{section.items.length > 0 ? (
							<ul className="tidelane-list">
								{section.items.map((item) => (
									<li
										key={`${id}-${item.lane.slug}-${item.lane.moon.cycle}`}
										className="tidelane-list__item"
									>
										<TidelaneCard item={item} />
									</li>
								))}
							</ul>
						) : (
							<p className="tidelane-section__empty">
								ENTRY_SET_EMPTY // {section.emptyMessage ?? 'No items right now.'}
							</p>
						)}
					</section>
				);
			})}
		</div>
	);
}
