// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { dayOf } from '../../domain/dates';
import type { Task } from '../../domain/types';
import { usePrefs } from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
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
