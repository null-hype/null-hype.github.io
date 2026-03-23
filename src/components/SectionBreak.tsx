import React from 'react';

export interface SectionBreakProps {
	readonly title: string;
	readonly eyebrow: string;
	readonly meta: string;
}

export default function SectionBreak({
	title,
	eyebrow,
	meta,
}: Readonly<SectionBreakProps>) {
	return (
		<div className="section-break">
			<h2 className="section-break__title">{title}</h2>
			<div className="section-break__meta">
				<span className="section-break__eyebrow">{eyebrow}</span>
				<span className="section-break__submeta">{meta}</span>
			</div>
		</div>
	);
}
