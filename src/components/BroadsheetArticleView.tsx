import React from 'react';
import { BroadsheetMasthead } from './BroadsheetMasthead';
import { IsoTideBackground } from './IsoTideBackground';
import { EditorialAbstract } from './EditorialAbstract';
import './BroadsheetArticleView.css';

export interface BroadsheetArticleViewProps {
	title: string;
	subtitle: string;
	abstract: string;
	children: React.ReactNode;
}

/**
 * Composable article view that wraps content in the Tidelands editorial style.
 */
export const BroadsheetArticleView: React.FC<BroadsheetArticleViewProps> = ({
	title,
	subtitle,
	abstract,
	children,
}) => {
	return (
		<div className="broadsheet-article-view">
			<div className="editorial-grain" aria-hidden="true" />
			<IsoTideBackground density={13} opacity={0.05} />
			<BroadsheetMasthead title={title} subtitle={subtitle} />

			<main className="broadsheet-article-main">
				<div className="editorial-container">
					<EditorialAbstract content={abstract} />
					<div className="broadsheet-article-content">{children}</div>
				</div>
			</main>

			<footer className="broadsheet-footer">
				<div className="editorial-container">
					<p>TIDELANDS // RESEARCH PROTOCOL // 2026</p>
				</div>
			</footer>
		</div>
	);
};
