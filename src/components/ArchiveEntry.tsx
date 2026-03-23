import React from 'react';

export interface ArchiveEntryProps {
	readonly index: string;
	readonly title: string;
	readonly href: string;
	readonly archivalId: string;
	readonly status: string;
	readonly statusTone?: 'default' | 'restricted';
}

export default function ArchiveEntry({
	index,
	title,
	href,
	archivalId,
	status,
	statusTone = 'default',
}: Readonly<ArchiveEntryProps>) {
	return (
		<a className="archive-entry" href={href}>
			<div className="archive-entry__content">
				<div className="archive-entry__heading">
					<span className="archive-entry__index">{index}</span>
					<span className="archive-entry__title">{title}</span>
				</div>
			</div>
			<div className="archive-entry__meta">
				<span>{archivalId}</span>
				<span className="archive-entry__status" data-tone={statusTone}>
					{status}
				</span>
			</div>
		</a>
	);
}
