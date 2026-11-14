// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('alert')).toHaveTextContent(/longer than 50/);
    expect(selected).toEqual([]);
  });

  it('Enter during IME composition selects and creates nothing', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'Ops');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(selected).toEqual([]);
    expect(tags()).toHaveLength(3);
  });

  it('Escape closes only the open dropdown', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'de');
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false); // default prevented
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    // Closed: Escape passes through to the dialog.
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
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
