export type OperationalPhase = 'breach' | 'patch' | 'verify';

export type TranscriptNotification =
	| {
			kind: 'agent';
			text: string;
	  }
	| {
			kind: 'tool';
			status?: 'completed' | 'in_progress';
			title: string;
	  }
	| {
			kind: 'user';
			text: string;
	  };

export type TerminalDiagnostic = {
	code: string;
	endColumn: number;
	endLineNumber: number;
	message: string;
	severity: 'error' | 'info' | 'warning';
	startColumn: number;
	startLineNumber: number;
};

export type TerminalDecoration = {
	className: string;
	endColumn: number;
	endLineNumber: number;
	hoverMarkdown?: string;
	startColumn: number;
	startLineNumber: number;
};

export type TerminalCodeLens = {
	commandId: string;
	lineNumber: number;
	title: string;
};

export type TerminalZoneWidget = {
	afterLineNumber: number;
	bodyMarkdown: string;
	className?: string;
	heightInLines?: number;
	id: string;
	title: string;
};

export type TerminalAffordances = {
	codeLenses: TerminalCodeLens[];
	decorations: TerminalDecoration[];
	diagnostics: TerminalDiagnostic[];
	hoverTerms: Array<{
		markdown: string;
		term: string;
	}>;
	zones: TerminalZoneWidget[];
};

export type TomorrowTerminalPhase = {
	affordances: TerminalAffordances;
	notifications: TranscriptNotification[];
	prompt: string;
	teamMode: 'blue' | 'red';
};

export type TomorrowTerminalTranscript = {
	directive: string;
	id: string;
	initialDocument: {
		language: string;
		value: string;
	};
	lab: string;
	persona: string;
	phases: Record<OperationalPhase, TomorrowTerminalPhase>;
	world: string;
};
