import React from 'react';

import ProjectLandingSection, {
	type ProjectLandingSectionData,
} from './ProjectLandingSection';

export interface TidelaneListProps {
	readonly sections: readonly ProjectLandingSectionData[];
}

export default function TidelaneList({ sections }: Readonly<TidelaneListProps>) {
	return (
		<div className="project-landing-list">
			{sections.map((section) => (
				<ProjectLandingSection
					key={section.id ?? section.title}
					id={section.id}
					title={section.title}
					summary={section.summary}
					emptyMessage={section.emptyMessage}
					items={section.items}
				/>
			))}
		</div>
	);
}
