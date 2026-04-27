import React from 'react';

export interface ProjectDigestProps {
	readonly title: string;
	readonly body: string;
	readonly href?: string;
	readonly latestUpdate?: string;
}

export default function ProjectDigest({
	title,
	body,
	href,
	latestUpdate,
}: Readonly<ProjectDigestProps>) {
	const titleNode = href ? (
		<a href={href} className="project-digest__title-link">
			{title}
		</a>
	) : (
		title
	);

	return (
		<article className="project-digest">
			<div className="project-digest__content">
				<h3 className="project-digest__title">{titleNode}</h3>

				<div className="project-digest__copy">
					{body ? <p className="project-digest__summary">{body}</p> : null}
					{latestUpdate ? <p className="project-digest__update">{latestUpdate}</p> : null}
				</div>
			</div>

			{href ? (
				<p className="project-digest__cta">
					<a href={href} className="project-digest__cta-link">
						Read project
					</a>
				</p>
			) : null}
		</article>
	);
}
