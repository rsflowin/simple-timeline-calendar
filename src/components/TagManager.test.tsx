// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
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
    await user.tab(); // blur after revert commits nothing
    expect(present()).toBe(doc);
  });

  it('renames on blur', async () => {
    const user = setup();
    const input = screen.getByRole('textbox', { name: 'Rename Urgent' });
    await user.clear(input);
    await user.type(input, 'Hot');
    await user.tab();
    expect(present().tags[0].name).toBe('Hot');
    expect(useRoadmap.getState().history.past).toEqual([doc]);
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

  it('reorders tags via drag and drop as one undo step', () => {
    setup();
    const list = screen.getByRole('list', { name: 'Tags' });
    [...list.querySelectorAll('li')].forEach((li, i) => {
      li.getBoundingClientRect = () => new DOMRect(0, i * 40, 400, 40);
    });

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder Urgent' }), {
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 70 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 70 }));
    });

    expect(present().tags.map((t) => t.id)).toEqual(['b', 'r']);
    expect(useRoadmap.getState().history.past).toEqual([doc]);

    useRoadmap.getState().undo();
    expect(present().tags.map((t) => t.id)).toEqual(['r', 'b']);
  });

  it('adds a tag on Enter as one undo step', async () => {
    const user = setup();
    await user.type(screen.getByRole('textbox', { name: 'New tag name' }), ' Design {Enter}');
    expect(present().tags.map((t) => t.name)).toEqual(['Urgent', 'Backend', 'Design']);
    expect(screen.getByRole('textbox', { name: 'Rename Design' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New tag name' })).toHaveValue('');
    expect(useRoadmap.getState().history.past).toEqual([doc]);
  });

  it('shows a duplicate-name error when adding, and changes nothing', async () => {
    const user = setup();
    await user.type(screen.getByRole('textbox', { name: 'New tag name' }), 'urgent');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tag "urgent" already exists');
    expect(present()).toBe(doc);
  });

  it('reorders tags with arrow keys on the handle', async () => {
    const user = setup();
    screen.getByRole('button', { name: 'Reorder Backend' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(present().tags.map((t) => t.id)).toEqual(['b', 'r']);
  });
});
