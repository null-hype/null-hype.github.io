import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BroadsheetArticleView } from '../components/BroadsheetArticleView';
import CaseNode from '../components/CaseNode';
import PullQuote from '../components/PullQuote';
import { caseNodes, pullQuoteContent } from '../data/editorialContent';

const meta = {
	title: 'Broadsheet/Views/Article View',
	component: BroadsheetArticleView,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetArticleView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GrammarAsProtocol: Story = {
	args: {
		title: 'GRAMMAR AS PROTOCOL',
		subtitle: 'TECHNICAL SPECIFICATION // DISPATCH 001',
		abstract:
			'Formal grammars serve as universal protocol layers that enable reliable agent-to-agent coordination in high-stakes security research workflows.',
		children: (
			<div className="editorial-case-stack">
				<CaseNode {...caseNodes[0]} />
				<PullQuote {...pullQuoteContent} />
				<CaseNode {...caseNodes[1]} />
				<CaseNode {...caseNodes[2]} />
			</div>
		),
	},
};
