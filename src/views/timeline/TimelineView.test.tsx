// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDayIndex, todayISO, toDayIndex } from '../../domain/dates';
import type { RoadmapDoc, Task } from '../../domain/types';
import { usePrefs } from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { QuickCreate } from '../../components/QuickCreate';
import { TimelineView, type TimelineHandle } from './TimelineView';

const today = toDayIndex(todayISO());
const task = (id: string, start: number, end: number, tagIds: string[] = []): Task => ({
  id,
  title: `Task ${id}`,
  details: '',
  start: fromDayIndex(today + start),
  end: fromDayIndex(today + end),
  tagIds,
  createdAt: '',
  updatedAt: '',
});

// a and b overlap; c fits after a in the same packed row
const doc: RoadmapDoc = {
  tags: [{ id: 'red', name: 'Urgent', color: 'red' }],
  tasks: [task('a', 0, 2, ['red']), task('b', 1, 3), task('c', 5, 6)],
};

const tops = (ids = ['a', 'b', 'c']) =>
  ids.map((id) => screen.getByRole('button', { name: new RegExp(`^Task ${id},`) }).style.top);

describe('TimelineView', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(doc);
    useUi.setState({ quickCreate: null, editing: null, selectedId: null, peekId: null });
    usePrefs.setState({
      zoom: 'day',
      packRows: true,
      tagRowMode: 'dedicated',
      groupLabels: false,
      tagFilter: [],
      clickCreate: true,
      dragBehavior: 'task',
    });
  });

  it('labels each bar with its title and date range', () => {
    render(<TimelineView />);
    const a = screen.getByRole('button', { name: /^Task a,/ });
    expect(a.getAttribute('aria-label')).toMatch(/^Task a, \w+ \d+ – \w+ \d+$/);
    // no native tooltip: the hover card shows the full title
    expect(a).not.toHaveAttribute('title');
  });

  it('puts a tag header above each tag group when tag headers are on', () => {
    usePrefs.setState({ groupLabels: true });
    render(<TimelineView />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('No tag')).toBeInTheDocument();
    // 24 px header, then the row; the untagged group gets its own header
    expect(tops()).toEqual(['28px', '84px', '84px']);
    act(() => usePrefs.setState({ tagRowMode: 'compact' }));
    expect(screen.queryByText('No tag')).toBeNull();
  });

  it('publishes the month at the centre for the toolbar title', () => {
    render(<TimelineView />);
    expect(useUi.getState().timelineTitle).toMatch(/^[A-Z][a-z]+ \d{4}$/);
  });

  it('packs tasks by tag group when packRows is on, or one row each when packing is off', () => {
    render(<TimelineView />);
    expect(tops()).toEqual(['4px', '36px', '36px']);
    act(() => usePrefs.setState({ packRows: false }));
    expect(tops()).toEqual(['4px', '36px', '68px']);
  });

  it('separates different tags in dedicated mode and merges non-overlapping tracks in compact mode', () => {
    useRoadmap.getState().reset({
      tags: [
        { id: 'red', name: 'Urgent', color: 'red' },
        { id: 'blue', name: 'Backend', color: 'blue' },
      ],
      tasks: [
        task('a', 0, 2, ['red']),
        task('b', 4, 6, ['blue', 'red']),
        task('c', 8, 10, ['red']),
        task('d', 12, 14),
      ],
    });
    render(<TimelineView />);
    // dedicated: red [a, c] on row 0, blue [b] on row 1, untagged [d] on row 2
    expect(tops(['a', 'b', 'c', 'd'])).toEqual(['4px', '36px', '4px', '68px']);

    // compact: non-overlapping tracks [a, c], [b], [d] all share row 0
    act(() => usePrefs.setState({ tagRowMode: 'compact' }));
    expect(tops(['a', 'b', 'c', 'd'])).toEqual(['4px', '4px', '4px', '4px']);

    // dedicated respects reordered tags: blue [b] moves above red [a, c]
    act(() => {
      usePrefs.setState({ tagRowMode: 'dedicated' });
      useRoadmap.getState().commit((d) => ({ ...d, tags: [...d.tags].reverse() }));
    });
    expect(tops(['a', 'b', 'c', 'd'])).toEqual(['36px', '4px', '36px', '68px']);
  });

  it('colours a bar by its first tag', () => {
    render(<TimelineView />);
    expect(screen.getByRole('button', { name: /^Task a,/ }).style.background).toBe(
      'var(--tag-red-bg)',
    );
  });

  it('hides tasks without a selected tag', () => {
    usePrefs.setState({ tagFilter: ['red'] });
    render(<TimelineView />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Task a']);
  });

  it('Enter on a focused bar selects it and opens the Task dialog (NF-4)', () => {
    useUi.setState({ editing: null, selectedId: null });
    render(<TimelineView />);
    fireEvent.click(screen.getByRole('button', { name: /^Task b,/ }), { detail: 0 });
    expect(useUi.getState()).toMatchObject({ selectedId: 'b', editing: { mode: 'edit', id: 'b' } });
  });

  it('renders only tasks overlapping the rendered range', () => {
    useRoadmap.getState().reset({ tags: [], tasks: [task('far', 5000, 5001), task('near', 0, 0)] });
    render(<TimelineView />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Task near']);
  });

  it('jumping far away re-centres the range instead of stretching it', () => {
    useRoadmap.getState().reset({ tags: [], tasks: [task('far', 5000, 5001), task('near', 0, 0)] });
    const ref = createRef<TimelineHandle>();
    render(<TimelineView ref={ref} />);
    act(() => ref.current!.scrollToDay(today + 5000));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Task far']);
  });

  it('pressing a bar closes an open quick-create', () => {
    render(
      <>
        <TimelineView />
        <QuickCreate />
      </>,
    );
    const anchor = new DOMRect(0, 0, 10, 10);
    act(() => useUi.getState().openQuickCreate({ start: '2026-01-01', end: '2026-01-01', anchor }));
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Task a,/ }), { button: 0 });
    expect(useUi.getState().quickCreate).toBeNull();
  });

  it('respects clickCreate=false while keeping drag-create in task mode', () => {
    usePrefs.setState({ clickCreate: false, dragBehavior: 'task' });
    render(<TimelineView />);
    const grid = screen.getByRole('region', { name: 'Timeline' }).querySelector('[class*="grid"]')!;

    fireEvent.pointerDown(grid, { button: 0, clientX: 50, clientY: 10 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 10 }));
    });
    expect(useUi.getState().quickCreate).toBeNull();

    fireEvent.pointerDown(grid, { button: 0, clientX: 50, clientY: 10 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 90, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 90, clientY: 10 }));
    });
    expect(useUi.getState().quickCreate).not.toBeNull();
  });

  it('disables drag-create, task drag, and resize handles when dragBehavior=none', () => {
    usePrefs.setState({ clickCreate: true, dragBehavior: 'none' });
    render(<TimelineView />);
    const scroller = screen.getByRole('region', { name: 'Timeline' });
    const grid = scroller.querySelector('[class*="grid"]')!;
    const bar = screen.getByRole('button', { name: /^Task a,/ });

    expect(bar.querySelector('[data-handle]')).toBeNull();

    // Dragging empty space does not open quick-create
    fireEvent.pointerDown(grid, { button: 0, clientX: 50, clientY: 10 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 120, clientY: 10 }));
    });
    expect(useUi.getState().quickCreate).toBeNull();

    // Clicking empty space still opens quick-create when clickCreate=true
    fireEvent.pointerDown(grid, { button: 0, clientX: 50, clientY: 10 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 10 }));
    });
    expect(useUi.getState().quickCreate).not.toBeNull();

    // Dragging a bar does not move it or open edit dialog
    const before = useRoadmap.getState().history.present.tasks[0];
    fireEvent.pointerDown(bar, { button: 0, clientX: 50, clientY: 10 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 150, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 150, clientY: 10 }));
    });
    expect(useRoadmap.getState().history.present.tasks[0]).toEqual(before);
    expect(useUi.getState().editing).toBeNull();

    // Clicking a bar still previews it; a double-click opens the Edit task dialog
    fireEvent.pointerDown(bar, { button: 0, clientX: 50, clientY: 10 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 10 }));
    });
    expect(useUi.getState().peekId).toBe('a');
    fireEvent.doubleClick(bar);
    expect(useUi.getState().editing).toEqual({ mode: 'edit', id: 'a' });
  });

  it('pans scrollLeft/scrollTop from both empty grid and task bars when dragBehavior=scroll', () => {
    usePrefs.setState({ clickCreate: false, dragBehavior: 'scroll' });
    render(<TimelineView />);
    const scroller = screen.getByRole('region', { name: 'Timeline' });
    const grid = scroller.querySelector('[class*="grid"]')!;
    const bar = screen.getByRole('button', { name: /^Task a,/ });

    scroller.scrollLeft = 200;
    scroller.scrollTop = 100;

    fireEvent.pointerDown(grid, { button: 0, clientX: 100, clientY: 80 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 60 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 60, clientY: 60 }));
    });
    expect(scroller.scrollLeft).toBe(240);
    expect(scroller.scrollTop).toBe(120);
    expect(useUi.getState().quickCreate).toBeNull();

    fireEvent.pointerDown(bar, { button: 0, clientX: 100, clientY: 80 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 70 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 130, clientY: 70 }));
    });
    expect(scroller.scrollLeft).toBe(210);
    expect(scroller.scrollTop).toBe(130);
    expect(useUi.getState().editing).toBeNull();
  });
});
