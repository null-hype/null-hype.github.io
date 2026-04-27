import React from 'react';

import type { ArticleScaffoldNode } from '../data/articleScaffoldContent';

export interface ScaffoldIssueCardProps extends ArticleScaffoldNode {}

export default function ScaffoldIssueCard({
	kind,
	title,
	paragraphs,
	subIssues = [],
}: Readonly<ScaffoldIssueCardProps>) {
	return (
		<article className={`scaffold-article__section scaffold-article__section--${kind}`}>
			<header className="scaffold-article__section-header">
				<h3 className="scaffold-article__section-title">{title}</h3>
			</header>

			<div className={kind === 'issue' ? 'editorial-note__copy' : 'editorial-prose'}>
				{paragraphs.map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
			</div>

			{subIssues.length > 0 ? (
				<div className="scaffold-article__subsections">
					{subIssues.map((subIssue) => (
						<ScaffoldIssueCard key={subIssue.id} {...subIssue} />
					))}
				</div>
			) : null}
		</article>
	);
}
