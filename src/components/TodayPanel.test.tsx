// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDayIndex, todayISO, toDayIndex } from '../domain/dates';
import { updateTask } from '../domain/doc';
import type { RoadmapDoc, Task } from '../domain/types';
import { usePrefs } from '../store/prefsStore';
import { useRoadmap } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { TaskPeek, TodayPanel } from './TodayPanel';

const today = toDayIndex(todayISO());
const task = (id: string, from: number, to: number, tagIds: string[] = []): Task => ({
  id,
  title: `Task ${id}`,
  details: `Details of ${id}`,
  start: fromDayIndex(today + from),
  end: fromDayIndex(today + to),
  tagIds,
  createdAt: '',
  updatedAt: '',
});

const doc: RoadmapDoc = {
  tags: [{ id: 'r', name: 'Urgent', color: 'red' }],
  tasks: [task('later', 1, 3), task('span', -2, 2, ['r']), task('past', -5, -1), task('now', 0, 0)],
};

const titles = () => screen.queryAllByRole('button', { name: /^Task / }).map((b) => b.textContent);

describe('TodayPanel', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(doc);
    usePrefs.setState({ tagFilter: [], agendaOpen: true });
    useUi.setState({ editing: null, selectedId: null, peekId: null, agendaDate: todayISO() });
  });

  it('lists only tasks overlapping today, earliest start first, with details', () => {
    render(<TodayPanel />);
    expect(titles()).toEqual(['Task span', 'Task now']);
    expect(screen.getByText('Details of span')).toBeInTheDocument();
    expect(screen.getByText(/day 3 of 5/)).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('honours the tag filter', () => {
    usePrefs.setState({ tagFilter: ['r'] });
    render(<TodayPanel />);
    expect(titles()).toEqual(['Task span']);
    expect(screen.getByText(/filtered by tags/)).toBeInTheDocument();
  });

  it('opens a task for editing when its title is clicked', () => {
    render(<TodayPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Task now' }));
    expect(useUi.getState().editing).toEqual({ mode: 'edit', id: 'now' });
  });

  it('shows an empty state and closes', () => {
    useRoadmap.getState().reset({ tags: [], tasks: [task('past', -5, -1)] });
    render(<TodayPanel />);
    expect(screen.getByText('Nothing scheduled today.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close agenda' }));
    expect(usePrefs.getState().agendaOpen).toBe(false);
  });

  it('steps days with Previous/Next day and resets with Today', () => {
    render(<TodayPanel />);
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(useUi.getState().agendaDate).toBe(fromDayIndex(today + 1));
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent('Today');
    expect(titles()).toEqual(['Task span', 'Task later']);
    expect(screen.getByText(/day 4 of 5/)).toBeInTheDocument();

    const todayBtn = screen.getByRole('button', { name: 'Today' });
    fireEvent.click(todayBtn);
    expect(useUi.getState().agendaDate).toBe(todayISO());
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Today');
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(useUi.getState().agendaDate).toBe(fromDayIndex(today - 1));
    expect(titles()).toEqual(['Task past', 'Task span']);
  });

  it('jumps to an arbitrary valid date from the date input and ignores invalid input', () => {
    render(<TodayPanel />);
    const input = screen.getByLabelText('Agenda date');
    const pastIso = fromDayIndex(today - 3);
    fireEvent.change(input, { target: { value: pastIso } });
    expect(useUi.getState().agendaDate).toBe(pastIso);
    expect(titles()).toEqual(['Task past']);

    fireEvent.change(input, { target: { value: '' } });
    expect(useUi.getState().agendaDate).toBe(pastIso);
  });

  it('creates a new task prefilled with the selected agenda date from empty or populated states', () => {
    const emptyDay = fromDayIndex(today + 10);
    useUi.setState({ agendaDate: emptyDay });
    render(<TodayPanel />);
    expect(screen.getByText(/Nothing scheduled on /)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    expect(useUi.getState().editing).toMatchObject({
      mode: 'new',
      draft: { start: emptyDay, end: emptyDay },
    });

    const populatedDay = fromDayIndex(today + 1);
    act(() => useUi.setState({ agendaDate: populatedDay, editing: null }));
    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    expect(useUi.getState().editing).toMatchObject({
      mode: 'new',
      draft: { start: populatedDay, end: populatedDay },
    });
  });

  it('clamps stepping at the 1900–2199 date bounds', () => {
    useUi.setState({ agendaDate: '1900-01-01' });
    render(<TodayPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(useUi.getState().agendaDate).toBe('1900-01-01');

    act(() => useUi.setState({ agendaDate: '2199-12-31' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(useUi.getState().agendaDate).toBe('2199-12-31');
  });
});

describe('TaskPeek', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(doc);
    useUi.setState({ editing: null, selectedId: 'span', peekId: 'span' });
  });

  it('edits the task in place: fields are prefilled, Save commits and closes', () => {
    render(<TaskPeek id="span" />);
    expect(screen.getByLabelText('Title')).toHaveValue('Task span');
    expect(screen.getByLabelText('Title')).not.toHaveFocus();
    expect(screen.getByLabelText('Details')).toHaveValue('Details of span');
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2099-1-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const saved = useRoadmap.getState().history.present.tasks.find((t) => t.id === 'span')!;
    expect(saved.title).toBe('Renamed');
    expect(saved.end).toBe('2099-01-02');
    expect(useUi.getState().peekId).toBeNull();
  });

  it('keeps edits when switching to another task or closing; Cancel discards them', () => {
    const title = (id: string) =>
      useRoadmap.getState().history.present.tasks.find((t) => t.id === id)!.title;
    const { rerender, unmount } = render(<TaskPeek id="span" />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Kept' } });
    rerender(<TaskPeek id="now" />);
    expect(title('span')).toBe('Kept');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Also kept' } });
    unmount(); // Esc / ✕
    expect(title('now')).toBe('Also kept');

    render(<TaskPeek id="later" />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Dropped' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(title('later')).toBe('Task later');
  });

  it('follows a drag underneath without losing what was typed', () => {
    render(<TaskPeek id="span" />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Typed' } });
    act(() => useRoadmap.getState().commit((d) => updateTask(d, 'span', { end: '2099-01-01' })));
    expect(screen.getByLabelText('End')).toHaveValue('2099-01-01');
    expect(screen.getByLabelText('Title')).toHaveValue('Typed');
  });

  it('deletes the task from the panel', () => {
    render(<TaskPeek id="span" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useRoadmap.getState().history.present.tasks.some((t) => t.id === 'span')).toBe(false);
    expect(useUi.getState().peekId).toBeNull();
  });

  it('closes, and closes itself when the task is gone', () => {
    const { rerender } = render(<TaskPeek id="span" />);
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(useUi.getState().peekId).toBeNull();
    useUi.setState({ peekId: 'gone' });
    rerender(<TaskPeek id="gone" />);
    expect(useUi.getState().peekId).toBeNull();
  });
});
