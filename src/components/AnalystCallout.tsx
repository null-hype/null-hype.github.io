import React from 'react';

export interface AnalystCalloutProps {
	readonly label: string;
	readonly text: string;
	readonly tone?: 'accent' | 'dark';
}

export default function AnalystCallout({
	label,
	text,
	tone = 'accent',
}: Readonly<AnalystCalloutProps>) {
	return (
		<aside className={`analyst-callout analyst-callout--${tone}`}>
			<span className="analyst-callout__label component-eyebrow">{label}</span>
			<p className="analyst-callout__text">{text}</p>
		</aside>
	);
}
