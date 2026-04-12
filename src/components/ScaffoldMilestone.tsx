import React from 'react';

export interface ScaffoldMilestoneProps {
	readonly title: string;
	readonly paragraphs: readonly string[];
	readonly status: string;
	readonly decision: string;
}

export default function ScaffoldMilestone({
	title,
	paragraphs,
	decision,
}: Readonly<ScaffoldMilestoneProps>) {
	return (
		<section className="scaffold-article__lead">
			<header className="scaffold-article__section-header">
				<h3 className="scaffold-article__section-title scaffold-article__section-title--lead">
					{title}
				</h3>
			</header>

			<div className="editorial-prose editorial-prose--lead">
				{paragraphs.map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
				<p className="scaffold-article__decision">{decision}</p>
			</div>
		</section>
	);
}
