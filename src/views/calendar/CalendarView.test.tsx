// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayOf, toDayIndex } from '../../domain/dates';
import type { Task } from '../../domain/types';
import { usePrefs } from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { CalendarView } from './CalendarView';

const task = (id: string, start: string, end: string): Task => ({
  id,
  title: `Task ${id}`,
  details: '',
  start,
  end,
  tagIds: [],
  createdAt: '',
  updatedAt: '',
});

const bars = (id: string) => screen.getAllByRole('button', { name: new RegExp(`^Task ${id},`) });

describe('CalendarView — month', () => {
  beforeEach(() => {
    useRoadmap.getState().reset({ tags: [], tasks: [] });
    usePrefs.setState({
      calendarMode: 'month',
      cursor: '2026-11-13',
      packRows: true,
      tagFilter: [],
    });
  });

  it('shows six Monday-first weeks for November 2026, from Oct 26 (CAL-1)', () => {
    const { container } = render(<CalendarView />);
    const days = [...container.querySelectorAll<HTMLElement>('[data-day]')].map((d) =>
      Number(d.dataset.day),
    );
    expect(days).toHaveLength(42);
    expect(days[0]).toBe(dayOf(2026, 9, 26));
    expect(days[41]).toBe(dayOf(2026, 11, 6));
  });

  it('splits a task at week boundaries, rounding only its real ends (CAL-2)', () => {
    useRoadmap.getState().reset({ tags: [], tasks: [task('a', '2026-11-05', '2026-11-20')] });
    render(<CalendarView />);
    const pieces = bars('a');
    expect(pieces).toHaveLength(3);
    expect(pieces.map((b) => b.hasAttribute('data-starts-here'))).toEqual([true, false, false]);
    expect(pieces.map((b) => b.hasAttribute('data-ends-here'))).toEqual([false, false, true]);
    expect(pieces[0]).toHaveAccessibleName('Task a, Nov 5 – Nov 20');
  });

  it('packs tasks into lanes, one lane each with Pack rows off (CAL-3)', () => {
    useRoadmap.getState().reset({
      tags: [],
      tasks: [task('a', '2026-11-02', '2026-11-03'), task('b', '2026-11-05', '2026-11-06')],
    });
    render(<CalendarView />);
    const tops = () => [bars('a')[0].style.top, bars('b')[0].style.top];
    expect(tops()).toEqual(['24px', '24px']);
    act(() => usePrefs.setState({ packRows: false }));
    expect(tops()).toEqual(['24px', '46px']);
  });
});

describe('CalendarView — gestures', () => {
  // jsdom has no layout: the pointer's clientX is the day index of the cell under it.
  const at = (iso: string) => ({ clientX: toDayIndex(iso), clientY: 0 });
  const win = (type: string, iso: string) =>
    act(() => {
      window.dispatchEvent(new MouseEvent(type, at(iso)));
    });
  const undoSteps = () => useRoadmap.getState().history.past.length;

  beforeEach(() => {
    document.elementsFromPoint = (x: number) => [...document.querySelectorAll(`[data-day="${x}"]`)];
    useRoadmap.getState().reset({ tags: [], tasks: [task('a', '2026-11-05', '2026-11-06')] });
    useUi.setState({ quickCreate: null, editing: null, selectedId: null });
    usePrefs.setState({
      calendarMode: 'month',
      cursor: '2026-11-13',
      packRows: true,
      tagFilter: [],
    });
  });
  afterEach(() => {
    delete (document as Partial<Document>).elementsFromPoint;
  });

  it('drag across two week rows opens quick-create for that range (CAL-5)', () => {
    const { container } = render(<CalendarView />);
    const cell = container.querySelector(`[data-day="${toDayIndex('2026-11-12')}"]`)!;
    fireEvent.pointerDown(cell, { button: 0, ...at('2026-11-12') });
    win('pointermove', '2026-11-10');
    win('pointermove', '2026-11-17');
    expect(screen.getAllByText('Nov 12 – Nov 17')).toHaveLength(2); // draft piece per row
    win('pointerup', '2026-11-17');
    expect(useUi.getState().quickCreate).toMatchObject({ start: '2026-11-12', end: '2026-11-17' });
  });

  it('a click on a day opens quick-create for that day', () => {
    const { container } = render(<CalendarView />);
    const cell = container.querySelector(`[data-day="${toDayIndex('2026-11-12')}"]`)!;
    fireEvent.pointerDown(cell, { button: 0, ...at('2026-11-12') });
    win('pointerup', '2026-11-12');
    expect(useUi.getState().quickCreate).toMatchObject({ start: '2026-11-12', end: '2026-11-12' });
  });

  it('moves a bar across a week boundary with one undo step (CAL-6)', () => {
    render(<CalendarView />);
    fireEvent.pointerDown(bars('a')[0], { button: 0, ...at('2026-11-05') });
    win('pointermove', '2026-11-15');
    expect(bars('a')).toHaveLength(2); // the preview reflows into the next week
    win('pointerup', '2026-11-15');
    expect(useRoadmap.getState().history.present.tasks[0]).toMatchObject({
      start: '2026-11-15',
      end: '2026-11-16',
    });
    expect(undoSteps()).toBe(1);
  });

  it('resizes from a real end only, and Esc cancels', () => {
    useRoadmap.getState().reset({ tags: [], tasks: [task('a', '2026-11-05', '2026-11-10')] });
    render(<CalendarView />);
    const [first, second] = bars('a');
    expect(first.querySelector('[data-handle="end"]')).toBeNull();
    const handle = second.querySelector('[data-handle="end"]')!;
    fireEvent.pointerDown(handle, { button: 0, ...at('2026-11-10') });
    win('pointermove', '2026-11-20');
    expect(bars('a')).toHaveLength(3); // previewing Nov 5 – 20
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    win('pointerup', '2026-11-20');
    expect(undoSteps()).toBe(0);
    expect(bars('a')[1]).toHaveAccessibleName('Task a, Nov 5 – Nov 10');
  });

  it('a click on a bar selects it and opens the Task dialog', () => {
    render(<CalendarView />);
    fireEvent.pointerDown(bars('a')[0], { button: 0, ...at('2026-11-05') });
    win('pointerup', '2026-11-05');
    expect(useUi.getState()).toMatchObject({ selectedId: 'a', editing: { mode: 'edit', id: 'a' } });
  });
});
