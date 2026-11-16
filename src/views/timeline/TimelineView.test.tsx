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
    usePrefs.setState({ zoom: 'day', packRows: true, tagRowMode: 'dedicated', tagFilter: [] });
  });

  it('labels each bar with its title and date range', () => {
    render(<TimelineView />);
    const a = screen.getByRole('button', { name: /^Task a,/ });
    expect(a.getAttribute('aria-label')).toMatch(/^Task a, \w+ \d+ – \w+ \d+$/);
    expect(a).toHaveAttribute('title', a.getAttribute('aria-label'));
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
});
