import React from 'react';
import { BroadsheetMasthead } from './BroadsheetMasthead';
import { IsoTideBackground } from './IsoTideBackground';
import { FleetStatusGrid, type TidelaneSlot } from './FleetStatusGrid';
import './BroadsheetDispatchView.css';

export interface BroadsheetDispatchViewProps {
	fleetSlots: TidelaneSlot[];
	children: React.ReactNode;
}

/**
 * The Tidelands Home/Dispatch view. A 3-column broadsheet layout.
 * Expects children to contain the columns.
 */
export const BroadsheetDispatchView: React.FC<BroadsheetDispatchViewProps> = ({
	fleetSlots,
	children,
}) => {
	return (
		<div className="broadsheet-dispatch-view">
			<div className="editorial-grain" aria-hidden="true" />
			<IsoTideBackground density={39} opacity={0.03} strokeWidth={0.3} />
			<BroadsheetMasthead title="TIDELANDS" subtitle="OFFICIAL DISPATCH // NODE 001" />

			<main className="broadsheet-dispatch-main">
				<div className="editorial-container">
					<div className="broadsheet-dispatch-grid">
						<section className="broadsheet-dispatch-col">
							<FleetStatusGrid slots={fleetSlots} />
						</section>

						{children}
					</div>
				</div>
			</main>
...
			<footer className="broadsheet-dispatch-footer">
				<div className="editorial-container">
					<div className="dispatch-footer-inner">
						<span>System Origin: tidelands.dev</span>
						<span>Lat: -33.8688 S // Long: 151.2093 E</span>
						<span>Infra: GCE + Dagger + Smallweb</span>
					</div>
				</div>
			</footer>
		</div>
	);
};
