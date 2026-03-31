import React from 'react';

export interface BroadsheetStampProps {
	readonly label: string;
	readonly value: string;
	readonly tone?: 'default' | 'accent' | 'signal' | 'muted';
}

export default function BroadsheetStamp({
	label,
	value,
	tone = 'default',
}: Readonly<BroadsheetStampProps>) {
	return (
		<span className="broadsheet-stamp" data-tone={tone}>
			<span className="broadsheet-stamp__label">{label}</span>
			<span className="broadsheet-stamp__value">{value}</span>
		</span>
	);
}
