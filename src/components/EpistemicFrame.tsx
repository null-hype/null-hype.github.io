import React from 'react';

import EpistemicFlag from './EpistemicFlag';

export interface EpistemicFrameProps {
	readonly eyebrow: string;
	readonly title: string;
	readonly flags: readonly {
		readonly label: string;
		readonly tone?: 'signal' | 'muted' | 'accent';
	}[];
	readonly boundaryLabel: string;
	readonly boundaries: readonly string[];
	readonly thesis: string;
	readonly paragraphs: readonly string[];
	readonly annexLabel: string;
	readonly annexHref: string;
}

export default function EpistemicFrame({
	eyebrow,
	title,
	flags,
	boundaryLabel,
	boundaries,
	thesis,
	paragraphs,
	annexHref,
	annexLabel,
}: Readonly<EpistemicFrameProps>) {
	return (
		<div className="epistemic-frame">
			<div className="epistemic-frame__rail">
				<span className="epistemic-frame__eyebrow">{eyebrow}</span>
				<h1 className="epistemic-frame__title">{title}</h1>
				<div className="epistemic-frame__flags" aria-label="Epistemic markers">
					{flags.map((flag) => (
						<EpistemicFlag key={flag.label} label={flag.label} tone={flag.tone} />
					))}
				</div>
				<div className="epistemic-frame__boundary">
					<span className="epistemic-frame__boundary-label component-eyebrow">
						{boundaryLabel}
					</span>
					<ol className="epistemic-frame__boundary-list">
						{boundaries.map((boundary, index) => (
							<li key={boundary}>
								<strong>{String(index + 1).padStart(2, '0')}.</strong>
								<span>{boundary}</span>
							</li>
						))}
					</ol>
				</div>
			</div>
			<div className="epistemic-frame__body">
				<p className="epistemic-frame__thesis">{thesis}</p>
				<div className="epistemic-frame__copy">
					{paragraphs.map((paragraph) => (
						<p key={paragraph}>{paragraph}</p>
					))}
				</div>
				<a className="epistemic-frame__annex" href={annexHref}>
					{annexLabel}
				</a>
			</div>
		</div>
	);
}
