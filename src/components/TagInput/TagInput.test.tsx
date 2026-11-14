// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTag, EMPTY_DOC } from '../../domain/doc';
import { useRoadmap } from '../../store/roadmapStore';
import { TagInput } from './TagInput';

let selected: string[] = [];

function Harness({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState(initial);
  return (
    <TagInput
      value={value}
      onChange={(ids) => {
        selected = ids;
        setValue(ids);
      }}
    />
  );
}

const tags = () => useRoadmap.getState().history.present.tags;
const idOf = (name: string) => tags().find((t) => t.name === name)!.id;

describe('TagInput', () => {
  beforeEach(() => {
    selected = [];
    let doc = createTag(EMPTY_DOC, 'Design', 'd');
    doc = createTag(doc, 'Dev', 'v');
    doc = createTag(doc, 'Marketing', 'm');
    useRoadmap.getState().reset(doc);
  });

  it('filters by typed text and Enter selects the highlighted tag', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'de');
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Design', 'Dev', 'Create "de"']);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(selected).toEqual(['v']);
    expect(input).toHaveValue('');
  });

  it('does not offer already-selected tags', async () => {
    render(<Harness initial={['d']} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Dev', 'Marketing']);
  });

  it('creates a new tag with Enter and selects it', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole('combobox'), 'Ops');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Create "Ops"');
    await userEvent.keyboard('{Enter}');
    expect(selected).toEqual([idOf('Ops')]);
    expect(useRoadmap.getState().history.past).toHaveLength(1);
  });

  it('offers no Create option for an exact (case-insensitive) match', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole('combobox'), 'dev');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Dev']);
  });

  it('shows the error when the tag cannot be created', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole('combobox'), 'x'.repeat(51));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText(/longer than 50/)).toBeInTheDocument();
    expect(selected).toEqual([]);
  });

  it('Backspace on an empty input removes the last chip', async () => {
    render(<Harness initial={['d', 'v']} />);
    await userEvent.type(screen.getByRole('combobox'), '{Backspace}');
    expect(selected).toEqual(['d']);
  });

  it('× removes a chip', async () => {
    render(<Harness initial={['d', 'v']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Design' }));
    expect(selected).toEqual(['v']);
  });
});
