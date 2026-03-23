import React from 'react';

import CounterargumentPanel from './CounterargumentPanel';

type CaseSupportingBlock =
	| {
			readonly type: 'grid';
			readonly items: readonly {
				readonly label: string;
				readonly value: string;
			}[];
	  }
	| {
			readonly type: 'list';
			readonly items: readonly {
				readonly label: string;
				readonly value: string;
			}[];
	  }
	| {
			readonly type: 'button' | 'link';
			readonly label: string;
			readonly href: string;
	  };

export interface CaseNodeProps {
	readonly nodeLabel: string;
	readonly title: string;
	readonly summary: string;
	readonly supportingBlock?: CaseSupportingBlock;
	readonly counterargument: string;
}

function renderSupportingBlock(block: CaseSupportingBlock) {
	if (block.type === 'grid') {
		return (
			<div className="case-node__support case-node__support-grid">
				{block.items.map((item) => (
					<div key={item.label} className="case-node__support-item">
						<span className="case-node__support-label">{item.label}</span>
						<span className="case-node__support-status">{item.value}</span>
					</div>
				))}
			</div>
		);
	}

	if (block.type === 'list') {
		return (
			<div className="case-node__support">
				<ul className="case-node__support-list">
					{block.items.map((item) => (
						<li key={item.label}>
							<span>{item.label}</span>
							<strong>{item.value}</strong>
						</li>
					))}
				</ul>
			</div>
		);
	}

	return (
		<div className="case-node__support case-node__support-link">
			<a
				className={block.type === 'button' ? 'case-node__button-link' : 'case-node__text-link'}
				href={block.href}
			>
				{block.label}
			</a>
		</div>
	);
}

export default function CaseNode({
	nodeLabel,
	title,
	summary,
	supportingBlock,
	counterargument,
}: Readonly<CaseNodeProps>) {
	const titleLines = title.split(' ');
	const lastWord = titleLines.pop();
	const head = titleLines.join(' ');

	return (
		<article className="case-node">
			<header className="case-node__meta">
				<span className="case-node__node-label">{nodeLabel}</span>
				<h3 className="case-node__title">
					{head}
					<br />
					{lastWord}
				</h3>
			</header>
			<div className="case-node__body">
				<p className="case-node__summary">{summary}</p>
				{supportingBlock ? renderSupportingBlock(supportingBlock) : null}
			</div>
			<div className="case-node__counter">
				<CounterargumentPanel body={counterargument} />
			</div>
		</article>
	);
}
