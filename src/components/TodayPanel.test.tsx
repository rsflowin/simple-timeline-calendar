// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDayIndex, todayISO, toDayIndex } from '../domain/dates';
import type { RoadmapDoc, Task } from '../domain/types';
import { usePrefs } from '../store/prefsStore';
import { useRoadmap } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { TodayPanel } from './TodayPanel';

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
    useUi.setState({ editing: null, selectedId: null });
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
    fireEvent.click(screen.getByRole('button', { name: "Close today's tasks" }));
    expect(usePrefs.getState().agendaOpen).toBe(false);
  });
});
