import React from 'react';
import { WaterStateGlyph, type WaterState } from './WaterStateGlyphs';
import './FleetStatusGrid.css';

export interface TidelaneSlot {
	id: string;
	moon: number;
	phase: 'waxing' | 'full' | 'waning';
	status: WaterState;
	label: string;
}

export interface FleetStatusGridProps {
	slots: TidelaneSlot[];
	title?: string;
}

export const FleetStatusGrid: React.FC<FleetStatusGridProps> = ({
	slots,
	title = 'THE FLEET',
}) => {
	return (
		<div className="fleet-grid">
			<h2 className="fleet-grid__title">{title}</h2>
			<div className="fleet-grid__slots">
				{slots.map((slot) => (
					<div
						key={slot.id}
						className="fleet-slot"
						title={`${slot.label} (Moon ${slot.moon} - ${slot.phase})`}
					>
						<WaterStateGlyph state={slot.status} size={20} className="fleet-slot__glyph" />
						<span className="fleet-slot__id">{slot.id}</span>
					</div>
				))}
			</div>
		</div>
	);
};
