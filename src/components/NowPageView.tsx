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
}: Readonly<NowPageViewProps>) {
	return (
		<div className="now-page">
			<div className="now-page__grain" aria-hidden="true"></div>

			<header className="now-header">
				<div className="now-shell now-header__inner">
					<a className="now-header__brand" href="/now">
						jungle.roaring.wave
					</a>
					<nav className="now-header__nav" aria-label="Primary">
						<a href="#now">Now</a>
						<a href="#recently-done">Recently done</a>
						<a href="/dossier">Dossier</a>
					</nav>
				</div>
			</header>

			<main className="now-main now-shell">
				<p className="now-kicker">CLASSIFIED // {meta.lastUpdated}</p>
				<h1 className="now-title">
					<JitterTitle text={meta.title} />
				</h1>

				<div className="now-intro">
					{meta.intro.map((paragraph) => (
						<p key={paragraph}>{paragraph}</p>
					))}
				</div>

				{warning ? (
					<div className="now-callout" role="status">
						<span className="font-label text-[10px] font-bold uppercase block mb-2">Warning: Structural Noise</span>
						<p>{warning}</p>
					</div>
				) : null}

				<TidelaneList sections={sections} />

				<footer className="now-footer">
					<p>{meta.footer}</p>
					<p>
						The deeper version of the current obsession lives in the{' '}
						<a href="/dossier">dossier</a>.
					</p>
				</footer>
			</main>
		</div>
	);
}
