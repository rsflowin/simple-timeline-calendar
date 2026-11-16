// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayOf, toDayIndex } from '../../domain/dates';
import type { Task } from '../../domain/types';
import { usePrefs } from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { CalendarView } from './CalendarView';

const task = (id: string, start: string, end: string, tagIds: string[] = []): Task => ({
  id,
  title: `Task ${id}`,
  details: '',
  start,
  end,
  tagIds,
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
      tagRowMode: 'dedicated',
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

  it('groups week lanes by tag in dedicated mode and merges non-overlapping tracks in compact mode', () => {
    useRoadmap.getState().reset({
      tags: [
        { id: 'earlier', name: 'Earlier', color: 'green' },
        { id: 't1', name: 'Tag 1', color: 'blue' },
        { id: 't2', name: 'Tag 2', color: 'orange' },
      ],
      tasks: [
        task('prev', '2026-10-27', '2026-10-28', ['earlier']),
        task('a', '2026-11-02', '2026-11-03', ['t1']),
        task('b', '2026-11-05', '2026-11-06', ['t2']),
        task('c', '2026-11-07', '2026-11-08', ['t1']),
      ],
    });
    render(<CalendarView />);
    const tops = () => [bars('a')[0].style.top, bars('b')[0].style.top, bars('c')[0].style.top];
    // 'earlier' has no task in Nov 2–8 so it takes no lane; t1 [a, c] on lane 0 (24px), t2 [b] on lane 1 (46px)
    expect(tops()).toEqual(['24px', '46px', '24px']);

    act(() => usePrefs.setState({ tagRowMode: 'compact' }));
    expect(tops()).toEqual(['24px', '24px', '24px']);
  });
});

describe('CalendarView — +N more (CAL-4)', () => {
  const realRO = globalThis.ResizeObserver;

  beforeEach(() => {
    // Six 50 px rows: room for the date line and one lane, so laneFit() is 1.
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 300,
    });
    globalThis.ResizeObserver = class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe() {
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    useUi.setState({ quickCreate: null, editing: null, selectedId: null });
    usePrefs.setState({
      calendarMode: 'month',
      cursor: '2026-11-13',
      packRows: true,
      tagFilter: [],
    });
    useRoadmap.getState().reset({
      tags: [],
      tasks: [task('a', '2026-11-10', '2026-11-11'), task('b', '2026-11-11', '2026-11-12')],
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    globalThis.ResizeObserver = realRO;
    delete (document as Partial<Document>).elementsFromPoint;
  });

  it('lists the hidden tasks; pressing inside the list does not start a drag-create', () => {
    const { container } = render(<CalendarView />);
    expect(screen.queryByRole('button', { name: /^Task a,/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 more on Nov 11' }));
    const pop = screen.getByRole('dialog', { name: 'Tasks on Nov 11' });
    expect(pop).toHaveTextContent('Task aTask b');
    // The popover sits over a day cell, which elementsFromPoint sees through.
    const cell = container.querySelector(`[data-day="${toDayIndex('2026-11-11')}"]`)!;
    document.elementsFromPoint = () => [pop, cell];
    fireEvent.pointerDown(pop, { button: 0 });
    window.dispatchEvent(new MouseEvent('pointerup'));
    expect(useUi.getState().quickCreate).toBeNull();
  });

  it('Esc closes the list and returns focus to its +N more button (NF-4)', () => {
    render(<CalendarView />);
    const more = screen.getByRole('button', { name: '2 more on Nov 11' });
    fireEvent.click(more);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Tasks on Nov 11' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(more).toHaveFocus();
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

describe('CalendarView — week', () => {
  beforeEach(() => {
    usePrefs.setState({
      calendarMode: 'week',
      cursor: '2026-11-13',
      packRows: true,
      tagRowMode: 'dedicated',
      tagFilter: [],
    });
  });

  it('shows Mon–Sun with dates and the first line of details on each bar (CAL-7, CAL-8)', () => {
    const t = { ...task('a', '2026-11-10', '2026-11-11'), details: 'First line\nsecond line' };
    useRoadmap.getState().reset({ tags: [], tasks: [t] });
    const { container } = render(<CalendarView />);
    expect(container.querySelectorAll('[data-day]')).toHaveLength(7);
    expect(screen.getByText('Mon 9')).toBeInTheDocument();
    expect(screen.getByText('Sun 15')).toBeInTheDocument();
    expect(bars('a')[0]).toHaveTextContent(/^Task aFirst line$/);
  });
});

describe('CalendarView — year', () => {
  beforeEach(() => {
    useUi.setState({ quickCreate: null, editing: null, selectedId: null });
    usePrefs.setState({
      calendarMode: 'year',
      cursor: '2026-11-13',
      packRows: true,
      tagFilter: [],
    });
    useRoadmap.getState().reset({
      tags: [],
      tasks: [
        task('a', '2026-11-12', '2026-11-13'),
        task('b', '2026-11-13', '2026-11-13'),
        task('c', '2026-11-13', '2026-11-14'),
        task('d', '2026-11-13', '2026-11-13'),
        task('e', '2026-11-14', '2026-11-14'),
      ],
    });
  });

  const day = (name: string) => screen.getByRole('button', { name });

  it('shades days by task count 1 / 2 / 3+ (CAL-9, CAL-10)', () => {
    render(<CalendarView />);
    expect(screen.getByRole('button', { name: 'January' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'December' })).toBeInTheDocument();
    expect(day('Nov 12, 1 task')).toHaveAttribute('data-level', '1');
    expect(day('Nov 14, 2 tasks')).toHaveAttribute('data-level', '2');
    expect(day('Nov 13, 4 tasks')).toHaveAttribute('data-level', '3');
    expect(day('Nov 15, 0 tasks')).not.toHaveAttribute('data-level');
  });

  it('a day lists its tasks and can add one there (CAL-11)', () => {
    render(<CalendarView />);
    fireEvent.click(day('Nov 14, 2 tasks'));
    const pop = screen.getByRole('dialog', { name: 'Tasks on Nov 14' });
    expect(pop).toHaveTextContent('Task cTask e+ Add task');
    fireEvent.click(screen.getByRole('button', { name: '+ Add task' }));
    expect(useUi.getState().quickCreate).toMatchObject({ start: '2026-11-14', end: '2026-11-14' });
  });

  it('an outside click closes the day list and returns focus to the day (NF-4)', () => {
    render(<CalendarView />);
    fireEvent.click(day('Nov 14, 2 tasks'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(day('Nov 14, 2 tasks')).toHaveFocus();
  });

  it('clicking a month name opens Month view for it (CAL-12)', () => {
    render(<CalendarView />);
    fireEvent.click(screen.getByRole('button', { name: 'March' }));
    expect(usePrefs.getState()).toMatchObject({ calendarMode: 'month', cursor: '2026-03-01' });
  });
});
