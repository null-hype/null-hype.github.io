import React from 'react';

import BroadsheetStamp from './BroadsheetStamp';

export interface BroadsheetArchiveEntryProps {
	readonly index: string;
	readonly title: string;
	readonly intent: string;
	readonly summary: string;
	readonly latestHeadline: string;
	readonly href: string;
	readonly layout?: 'standard' | 'tall' | 'wide';
	readonly visualLabel?: string;
	readonly locked?: boolean;
	readonly lockedLabel?: string;
}

export default function BroadsheetArchiveEntry({
	index,
	title,
	intent,
	summary,
	latestHeadline,
	href,
	layout = 'standard',
	visualLabel,
	locked = false,
	lockedLabel = 'Access Required',
}: Readonly<BroadsheetArchiveEntryProps>) {
	return (
		<a className="broadsheet-archive-entry" data-layout={layout} href={href}>
			<div className="broadsheet-archive-entry__main">
				<div className="broadsheet-archive-entry__header">
					<span className="broadsheet-archive-entry__index">{index}</span>
				</div>
				<h3 className="broadsheet-archive-entry__title">{title}</h3>
				<BroadsheetStamp label="Intent" value={intent} tone="accent" />
				<p className="broadsheet-archive-entry__summary">{summary}</p>
				{visualLabel ? (
					<div className="broadsheet-archive-entry__visual">
						<span>{visualLabel}</span>
					</div>
				) : null}
				<div className="broadsheet-archive-entry__latest">
					<span className="broadsheet-archive-entry__latest-label">Latest Transcript</span>
					<span className="broadsheet-archive-entry__latest-headline">{latestHeadline}</span>
				</div>
			</div>
			{locked ? (
				<div className="broadsheet-archive-entry__lockup">
					<div className="broadsheet-archive-entry__keyhole" aria-hidden="true">
						Key
					</div>
					<span className="broadsheet-archive-entry__lock-label">{lockedLabel}</span>
				</div>
			) : null}
		</a>
	);
}
