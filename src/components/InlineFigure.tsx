import React from 'react';

export interface InlineFigureProps {
	readonly plateLabel: string;
	readonly imageSrc: string;
	readonly imageAlt: string;
	readonly caption: string;
}

export default function InlineFigure({
	plateLabel,
	imageSrc,
	imageAlt,
	caption,
}: Readonly<InlineFigureProps>) {
	return (
		<figure className="inline-figure">
			<div className="inline-figure__media">
				<div className="inline-figure__frame">
					<img className="inline-figure__image" src={imageSrc} alt={imageAlt} />
				</div>
			</div>
			<figcaption className="inline-figure__caption">
				<span className="inline-figure__plate">{plateLabel}</span>
				<p className="inline-figure__text">{caption}</p>
			</figcaption>
		</figure>
	);
}
