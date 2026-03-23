import React from 'react';

export interface PullQuoteProps {
	readonly quote: string;
	readonly attribution?: string;
}

export default function PullQuote({
	quote,
	attribution,
}: Readonly<PullQuoteProps>) {
	return (
		<blockquote className="pull-quote">
			<span className="pull-quote__mark" aria-hidden="true">
				"
			</span>
			{quote}
			{attribution ? <cite className="pull-quote__attribution">{attribution}</cite> : null}
		</blockquote>
	);
}
