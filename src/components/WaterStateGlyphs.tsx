import React from 'react';
import './WaterStateGlyphs.css';

export type WaterState = 'pool' | 'sea' | 'rain';

export interface WaterStateGlyphProps {
	state: WaterState;
	size?: number | string;
	color?: string;
	className?: string;
}

export const WaterStateGlyph: React.FC<WaterStateGlyphProps> = ({
	state,
	size = 32,
	color = 'var(--tidelands-ink)',
	className = '',
}) => {
	const styles = {
		width: size,
		height: size,
		color: color,
	};

	return (
		<div className={`water-glyph water-glyph--${state} ${className}`} style={styles}>
			{state === 'pool' && (
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
				</svg>
			)}
			{state === 'sea' && (
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M16 30C23.732 30 30 23.732 30 16C30 8.26801 23.732 2 16 2"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M16 30C8.26801 30 2 23.732 2 16C2 8.26801 8.26801 2 16 2"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path d="M10 6C12 4 14 4 16 6" stroke="currentColor" strokeWidth="1.5" />
					<path d="M16 6C18 8 20 8 22 6" stroke="currentColor" strokeWidth="1.5" />
				</svg>
			)}
			{state === 'rain' && (
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<line x1="8" y1="6" x2="8" y2="26" stroke="currentColor" strokeWidth="1.5" />
					<line x1="12" y1="6" x2="12" y2="26" stroke="currentColor" strokeWidth="1.5" />
					<line x1="16" y1="6" x2="16" y2="26" stroke="currentColor" strokeWidth="1.5" />
					<line x1="20" y1="6" x2="20" y2="26" stroke="currentColor" strokeWidth="1.5" />
					<line x1="24" y1="6" x2="24" y2="26" stroke="currentColor" strokeWidth="1.5" />
				</svg>
			)}
		</div>
	);
};
