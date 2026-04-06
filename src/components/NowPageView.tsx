import React from 'react';

import TidelaneList, { type TidelaneListSection } from './TidelaneList';

export interface NowPageMeta {
	readonly lastUpdated: string;
	readonly title: string;
	readonly intro: readonly string[];
	readonly footer: string;
}

export interface NowPageViewProps {
	readonly meta: NowPageMeta;
	readonly sections: readonly TidelaneListSection[];
	readonly warning?: string;
	readonly isFavorited?: boolean;
}

/**
 * Applies random baseline shifts to a string to mimic manual typesetting errors.
 */
function JitterTitle({ text }: { text: string }) {
	return (
		<>
			{text.split(' ').map((word, wordIndex) => (
				<span key={wordIndex} className="now-title__word">
					{word.split('').map((char, charIndex) => {
						const jitter = (wordIndex + charIndex) % 7 === 0;
						const dir = (wordIndex + charIndex) % 2 === 0 ? 'up' : 'down';
						return (
							<span 
								key={charIndex} 
								className={jitter ? `baseline-shift-${dir}` : undefined}
							>
								{char}
							</span>
						);
					})}
					{' '}
				</span>
			))}
		</>
	);
}

export default function NowPageView({
	meta,
	sections,
	warning,
	isFavorited = true,
}: Readonly<NowPageViewProps>) {
	return (
		<div className="now-page" data-favorited={isFavorited}>
			<div className="now-page__grain" aria-hidden="true"></div>

			<main className="now-main now-shell">
				{isFavorited ? (
					<>
						{warning ? (
							<div className="now-callout" role="status">
								<span className="font-label text-[10px] font-bold uppercase block mb-2">Warning: Structural Noise</span>
								<p>{warning}</p>
							</div>
						) : null}

						<TidelaneList sections={sections} />
					</>
				) : (
					<div className="now-coming-soon">
						<p className="now-kicker">STAGING // RESTRICTED ACCESS</p>
						<h1 className="now-title">Coming Soon!</h1>
						<div className="now-intro">
							<p>This view is currently private or under development. Check back soon for the full dossier.</p>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
