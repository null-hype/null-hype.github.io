import React from 'react';

import type { ArticleScaffoldContent } from '../data/articleScaffoldContent';
import ScaffoldIssueCard from './ScaffoldIssueCard';
import ScaffoldMilestone from './ScaffoldMilestone';

export default function ArticleScaffoldMap({
	projectTitle,
	projectSummary,
	articleTitle,
	articleDek,
	milestone,
	issues,
	latestUpdateLabel,
	latestUpdateText,
}: Readonly<ArticleScaffoldContent>) {
	return (
		<div className="scaffold-article">
			<div className="editorial-section-break-wrap">
				<div className="editorial-container">
					<div className="section-break scaffold-article__break">
						<h2 className="section-break__title">{articleTitle}</h2>
						<div className="section-break__meta">
							<span className="section-break__submeta">
								{milestone.title} // {projectTitle}
							</span>
						</div>
					</div>
				</div>
			</div>

			<section className="editorial-section">
				<div className="editorial-container editorial-prose">
					<p>{projectSummary}</p>
					<p>
						<strong>{latestUpdateLabel}:</strong> {latestUpdateText}
					</p>
				</div>
			</section>

			<section className="editorial-section">
				<div className="editorial-container">
					<header className="scaffold-article__header">
						<p className="scaffold-article__dek">{articleDek}</p>
					</header>
					<ScaffoldMilestone {...milestone} />
				</div>
			</section>

			<section className="editorial-section">
				<div className="editorial-container">
					<div className="scaffold-article__sections">
						{issues.map((issue) => (
							<ScaffoldIssueCard key={issue.id} {...issue} />
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
