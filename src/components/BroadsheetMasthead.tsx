import React from 'react';
import './BroadsheetMasthead.css';

export interface BroadsheetMastheadProps {
	title?: string;
	subtitle?: string;
	glitch?: boolean;
}

export const BroadsheetMasthead: React.FC<BroadsheetMastheadProps> = ({
	title = 'TIDELANDS',
	subtitle = 'RESEARCH BROADSHEET // DISPATCH 001',
	glitch = true,
}) => {
	return (
		<header className="broadsheet-masthead">
			<div
				className={`broadsheet-masthead__title ${glitch ? 'is-glitched' : ''}`}
				data-text={title}
			>
				{title}
			</div>
			<div className="broadsheet-masthead__meta">{subtitle}</div>
		</header>
	);
};
