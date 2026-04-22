import React, { useEffect, useMemo, useState } from 'react';
import { GooseMobileClientView } from '../GooseMobileClient';
import MonacoAffordanceWorkbench from './MonacoAffordanceWorkbench';
import { buildMockAcpNotifications } from './withAcpTranscript';
import type { OperationalPhase, TomorrowTerminalTranscript } from './types';
import './TomorrowsTerminal.css';

const phaseLabels: Record<OperationalPhase, string> = {
	breach: 'Breach',
	patch: 'Patch',
	verify: 'Verify',
};

export default function PurpleWorldShell({
	phase = 'breach',
	transcript,
}: {
	phase?: OperationalPhase;
	transcript: TomorrowTerminalTranscript;
}) {
	const activePhase = transcript.phases[phase] ?? transcript.phases.breach;
	const [prompt, setPrompt] = useState(activePhase.prompt);
	const sessionId = `sess_${transcript.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${phase}`;
	const notifications = useMemo(
		() =>
			buildMockAcpNotifications({
				notifications: activePhase.notifications,
				sessionId,
				startTime: 1_700_000_000_000,
			}),
		[activePhase.notifications, sessionId],
	);

	useEffect(() => {
		setPrompt(activePhase.prompt);
	}, [activePhase.prompt]);

	return (
		<section
			className="tt-world-shell"
			aria-label={`${transcript.persona} ${transcript.lab}`}
			data-operational-phase={phase}
		>
			<header className="tt-world-header">
				<div>
					<p className="tt-world-kicker">{transcript.persona}</p>
					<h1>
						{transcript.id}: {transcript.lab}
					</h1>
				</div>
				<dl aria-label="World metadata">
					<div>
						<dt>World</dt>
						<dd>{transcript.world}</dd>
					</div>
					<div>
						<dt>Directive</dt>
						<dd>{transcript.directive}</dd>
					</div>
					<div>
						<dt>Phase</dt>
						<dd>{phaseLabels[phase]}</dd>
					</div>
				</dl>
			</header>
			<div className="tt-world-grid">
				<MonacoAffordanceWorkbench
					affordances={activePhase.affordances}
					initialValue={transcript.initialDocument.value}
					phase={phase}
				/>
				<GooseMobileClientView
					activeSessionId={sessionId}
					bootstrapState="ready"
					canCreateSession={false}
					canSendPrompt={Boolean(prompt.trim())}
					connectionStatus="connected"
					cwd="/workspaces/tomorrows-terminal"
					isBusy={false}
					notifications={notifications}
					onCancelPermission={() => undefined}
					onDisconnect={() => undefined}
					onPromptChange={setPrompt}
					onResolvePermission={() => undefined}
					onSendPrompt={() => undefined}
					onStartChat={() => undefined}
					pendingPermission={null}
					prompt={prompt}
					promptHintMode="mock-goose"
					teamMode={activePhase.teamMode}
					title={`${transcript.id} ${phaseLabels[phase]}`}
					wsUrl="fixture://acp/transcript"
				/>
			</div>
		</section>
	);
}
