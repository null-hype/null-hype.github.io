import type { Meta, StoryObj } from '@storybook/react-vite';

import CaseNode from '../../components/CaseNode';
import { caseNodes } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/CaseNode',
	component: CaseNode,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof CaseNode>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignalGrid: Story = {
	args: caseNodes[0],
};

export const FactList: Story = {
	args: caseNodes[2],
};

export const ActionLink: Story = {
	args: caseNodes[1],
};

export const Doctrine: Story = {
	args: caseNodes[3],
};
