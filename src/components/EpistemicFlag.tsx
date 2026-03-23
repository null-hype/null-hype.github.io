import React from 'react';

export interface EpistemicFlagProps {
	readonly label: string;
	readonly tone?: 'signal' | 'muted' | 'accent';
}

export default function EpistemicFlag({
	label,
	tone = 'muted',
}: Readonly<EpistemicFlagProps>) {
	return <span className={`epistemic-flag epistemic-flag--${tone}`}>{label}</span>;
}
