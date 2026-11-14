// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RoadmapDoc } from '../domain/types';
import { useRoadmap } from '../store/roadmapStore';
import { TagManager } from './TagManager';

const doc: RoadmapDoc = {
  tags: [
    { id: 'r', name: 'Urgent', color: 'red' },
    { id: 'b', name: 'Backend', color: 'blue' },
  ],
  tasks: [
    {
      id: 't',
      title: 'Task',
      details: '',
      start: '2026-01-05',
      end: '2026-01-09',
      tagIds: ['r', 'b'],
      createdAt: '',
      updatedAt: '',
    },
  ],
};

const present = () => useRoadmap.getState().history.present;

describe('TagManager', () => {
  beforeEach(() => useRoadmap.getState().reset(doc));

  const setup = () => {
    const user = userEvent.setup();
    render(<TagManager open onClose={() => {}} />);
    return user;
  };

  it('renames on Enter', async () => {
    const user = setup();
    const input = screen.getByRole('textbox', { name: 'Rename Urgent' });
    await user.clear(input);
    await user.type(input, 'Hot{Enter}');
    expect(present().tags[0].name).toBe('Hot');
  });

  it('shows a duplicate-name error inline and keeps the typed text; Escape reverts', async () => {
    const user = setup();
    const input = screen.getByRole('textbox', { name: 'Rename Urgent' });
    await user.clear(input);
    await user.type(input, 'backend');
    await user.tab(); // blur commits
    expect(screen.getByRole('alert')).toHaveTextContent('Tag "backend" already exists');
    expect(input).toHaveValue('backend');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(present()).toBe(doc);

    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('Urgent');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('changes colour with a swatch', async () => {
    const user = setup();
    const green = screen.getAllByRole('button', { name: 'Green' })[0];
    expect(green).toHaveAttribute('aria-pressed', 'false');
    await user.click(green);
    expect(present().tags[0].color).toBe('green');
    expect(green).toHaveAttribute('aria-pressed', 'true');
  });

  it('deletes a tag from its tasks, and undo restores it', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Delete Urgent' }));
    expect(present().tags.map((t) => t.name)).toEqual(['Backend']);
    expect(present().tasks[0].tagIds).toEqual(['b']);

    useRoadmap.getState().undo();
    expect(present()).toBe(doc);
  });
});
