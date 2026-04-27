import React from 'react';

import ProjectDigest from './ProjectDigest';

export interface ProjectLandingItem {
	readonly title: string;
	readonly body: string;
	readonly href?: string;
	readonly projectId: string;
	readonly status: string;
	readonly issueCount: number;
	readonly priority?: string;
	readonly updatedAt?: string;
	readonly updatedAtIso?: string;
	readonly latestUpdate?: string;
}

export interface ProjectLandingSectionData {
	readonly id?: string;
	readonly title: string;
	readonly summary?: string;
	readonly emptyMessage?: string;
	readonly items: readonly ProjectLandingItem[];
}

function toIdFragment(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function ProjectLandingSection({
	id,
	title,
	emptyMessage,
	items,
}: Readonly<ProjectLandingSectionData>) {
	const sectionId = id ?? toIdFragment(title);
	const headingId = `${sectionId}-heading`;

	return (
		<section
			className="project-landing-section"
			id={sectionId}
			aria-labelledby={headingId}
		>
			<header className="project-landing-section__header">
				<p className="project-landing-section__eyebrow">Initiative</p>
				<h2 id={headingId} className="project-landing-section__title">
					{title}
				</h2>
			</header>

			{items.length > 0 ? (
				<div className="project-landing-section__stack">
					{items.map((item) => (
						<ProjectDigest
							key={`${sectionId}-${item.projectId}`}
							title={item.title}
							body={item.body}
							href={item.href}
							latestUpdate={item.latestUpdate}
						/>
					))}
				</div>
			) : emptyMessage ? (
				<div className="editorial-prose project-landing-section__empty">
					<p>{emptyMessage}</p>
				</div>
			) : null}
		</section>
	);
}
