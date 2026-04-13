import React, { useMemo } from 'react';
import './IsoTideBackground.css';

export interface IsoTideBackgroundProps {
	density?: number;
	seed?: string | number;
	color?: string;
	opacity?: number;
	strokeWidth?: number;
}

/**
 * Generative background component that draws irregular concentric curves
 * mimicking hydrographic/bathymetric charts.
 */
export const IsoTideBackground: React.FC<IsoTideBackgroundProps> = ({
	density = 13,
	seed = 'tidelands',
	color = 'var(--tidelands-ink)',
	opacity = 0.1,
	strokeWidth = 0.5,
}) => {
	const paths = useMemo(() => {
		const result = [];
		const centerX = 500;
		const centerY = 500;
		const s = typeof seed === 'string' ? seed.length : Number(seed);

		for (let i = 0; i < density; i++) {
			const radius = 100 + i * 35;
			const points = [];
			for (let angle = 0; angle <= 360; angle += 5) {
				const rad = (angle * Math.PI) / 180;
				// Multiple layered sine waves for "estuary" irregularity
				const wobble =
					Math.sin(rad * 3 + i * 0.5 + s) * 15 +
					Math.cos(rad * 7 - i * 0.2) * 10 +
					Math.sin(rad * 2 + s * 0.1) * 20;

				const r = radius + wobble;
				const x = centerX + r * Math.cos(rad);
				const y = centerY + r * Math.sin(rad);
				points.push(`${angle === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`);
			}
			result.push(points.join(' ') + ' Z');
		}
		return result;
	}, [density, seed]);

	return (
		<div className="iso-tide-background">
			<svg
				viewBox="0 0 1000 1000"
				preserveAspectRatio="xMidYMid slice"
				xmlns="http://www.w3.org/2000/svg"
			>
				{paths.map((d, i) => (
					<path
						key={i}
						d={d}
						fill="none"
						stroke={color}
						strokeWidth={strokeWidth}
						opacity={opacity}
					/>
				))}
			</svg>
		</div>
	);
};
