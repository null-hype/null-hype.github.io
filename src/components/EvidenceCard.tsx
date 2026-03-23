import React from 'react';

export interface EvidenceCardProps {
	readonly variant: 'metric' | 'quote' | 'signal';
	readonly label: string;
	readonly value?: string;
	readonly description?: string;
	readonly quote?: string;
	readonly bars?: readonly number[];
	readonly status?: string;
}

export default function EvidenceCard({
	variant,
	label,
	value,
	description,
	quote,
	bars = [],
	status,
}: Readonly<EvidenceCardProps>) {
	const labelClass =
		variant === 'quote' ? 'evidence-card__label evidence-card__label--accent' : 'evidence-card__label';

	return (
		<article className={`evidence-card evidence-card--${variant}`}>
			<span className={labelClass}>{label}</span>
			{variant === 'metric' ? (
				<>
					{value ? <span className="evidence-card__value">{value}</span> : null}
					{description ? <p className="evidence-card__description">{description}</p> : null}
				</>
			) : null}
			{variant === 'quote' ? (
				<p className="evidence-card__quote">{quote}</p>
			) : null}
			{variant === 'signal' ? (
				<>
					<div className="evidence-card__signal-bars" aria-hidden="true">
						{bars.map((bar, index) => (
							<div
								key={`${bar}-${index}`}
								className="evidence-card__signal-bar"
								data-fade={index === 1 ? 'soft' : index > 1 ? 'faint' : 'none'}
								style={{ width: `${bar * 100}%` }}
							/>
						))}
					</div>
					{status ? <p className="evidence-card__description">{status}</p> : null}
				</>
			) : null}
		</article>
	);
}
