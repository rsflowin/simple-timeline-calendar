// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayISO } from '../../domain/dates';
import { addTask, EMPTY_DOC } from '../../domain/doc';
import { useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { TaskDialog } from './TaskDialog';

const tasks = () => useRoadmap.getState().history.present.tasks;
const save = () => screen.getByRole('button', { name: 'Save' });
const existing = {
  title: 'Ship',
  details: 'notes',
  start: '2026-03-02',
  end: '2026-03-06',
  tagIds: [],
};

function openWith(fn: () => void) {
  render(<TaskDialog />);
  act(fn);
}

describe('TaskDialog', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(EMPTY_DOC);
    useUi.getState().close();
  });

  it('saves a new task (today – today) and closes', async () => {
    openWith(() => useUi.getState().openNew());
    expect(screen.getByRole('dialog', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await userEvent.type(screen.getByLabelText('Title'), '  Plan  ');
    await userEvent.click(save());
    expect(tasks()).toMatchObject([{ title: 'Plan', start: todayISO(), end: todayISO() }]);
    expect(useUi.getState().editing).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves with Ctrl+Enter', async () => {
    openWith(() => useUi.getState().openNew());
    await userEvent.type(screen.getByLabelText('Title'), 'Plan{Control>}{Enter}{/Control}');
    expect(tasks()).toHaveLength(1);
  });

  it('Ctrl+Enter during IME composition does not save', async () => {
    openWith(() => useUi.getState().openNew());
    await userEvent.type(screen.getByLabelText('Title'), 'Plan');
    fireEvent.keyDown(screen.getByLabelText('Title'), {
      key: 'Enter',
      ctrlKey: true,
      isComposing: true,
    });
    expect(tasks()).toHaveLength(0);
  });

  it('disables Save while the title is blank', async () => {
    openWith(() => useUi.getState().openNew());
    expect(save()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Title'), '   ');
    expect(save()).toBeDisabled();
  });

  it('moves End with Start, and blocks End before Start', () => {
    openWith(() => useUi.getState().openNew({ start: '2026-01-05', end: '2026-01-06' }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-01-10' } });
    expect(screen.getByLabelText('End')).toHaveValue('2026-01-10');
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-01-08' } });
    expect(screen.getByText("End date can't be before start date")).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('prefills an existing task and updates it as one undo step', async () => {
    useRoadmap.getState().reset(addTask(EMPTY_DOC, existing, 't1'));
    openWith(() => useUi.getState().openEdit('t1'));
    expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Ship');
    expect(screen.getByLabelText('Details')).toHaveValue('notes');
    expect(screen.getByLabelText('End')).toHaveValue('2026-03-06');
    await userEvent.type(screen.getByLabelText('Title'), ' it');
    await userEvent.click(save());
    expect(tasks()[0].title).toBe('Ship it');
    expect(useRoadmap.getState().history.past).toHaveLength(1);
  });

  it('saving an unchanged task adds no undo step', async () => {
    useRoadmap.getState().reset(addTask(EMPTY_DOC, existing, 't1'));
    openWith(() => useUi.getState().openEdit('t1'));
    await userEvent.click(save());
    expect(useRoadmap.getState().history.past).toHaveLength(0);
    expect(useUi.getState().editing).toBeNull();
  });

  it('Delete removes the task and undo restores it', async () => {
    useRoadmap.getState().reset(addTask(EMPTY_DOC, existing, 't1'));
    openWith(() => useUi.getState().openEdit('t1'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(tasks()).toHaveLength(0);
    expect(useUi.getState().editing).toBeNull();
    act(() => useRoadmap.getState().undo());
    expect(tasks()).toMatchObject([{ id: 't1', title: 'Ship' }]);
  });

  it('Delete clears the selection and hands focus back to the view (NF-4)', async () => {
    const onDeleted = vi.fn();
    useRoadmap.getState().reset(addTask(EMPTY_DOC, existing, 't1'));
    useUi.getState().select('t1');
    render(<TaskDialog onDeleted={onDeleted} />);
    act(() => useUi.getState().openEdit('t1'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useUi.getState().selectedId).toBeNull();
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Cancel closes without saving', async () => {
    openWith(() => useUi.getState().openNew());
    await userEvent.type(screen.getByLabelText('Title'), 'Plan');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(tasks()).toHaveLength(0);
    expect(useUi.getState().editing).toBeNull();
  });
});
