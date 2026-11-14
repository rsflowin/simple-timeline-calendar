// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { todayISO } from '../domain/dates';
import type { RoadmapDoc, Task } from '../domain/types';
import { usePrefs } from '../store/prefsStore';
import { useRoadmap } from '../store/roadmapStore';
import { TimelineView } from '../views/timeline/TimelineView';
import { TagFilter } from './TagFilter';

const task = (id: string, tagIds: string[]): Task => ({
  id,
  title: `Task ${id}`,
  details: '',
  start: todayISO(),
  end: todayISO(),
  tagIds,
  createdAt: '',
  updatedAt: '',
});

const doc: RoadmapDoc = {
  tags: [
    { id: 'r', name: 'Urgent', color: 'red' },
    { id: 'b', name: 'Backend', color: 'blue' },
  ],
  tasks: [task('a', ['r']), task('b', ['b']), task('c', [])],
};

const bars = () =>
  screen
    .queryAllByRole('button', { name: /^Task \w,/ })
    .map((b) => b.getAttribute('aria-label')!.split(',')[0]);

describe('TagFilter', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(doc);
    usePrefs.setState({ zoom: 'day', tagFilter: [] });
  });

  it('shows only tasks having any selected tag; Clear shows all again', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TagFilter />
        <TimelineView />
      </>,
    );
    expect(bars()).toEqual(['Task a', 'Task b', 'Task c']);

    await user.click(screen.getByRole('button', { name: 'Tags' }));
    await user.click(screen.getByRole('checkbox', { name: 'Urgent' }));
    expect(bars()).toEqual(['Task a']);
    expect(screen.getByRole('button', { name: 'Tags (1)' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Backend' }));
    expect(bars()).toEqual(['Task a', 'Task b']);
    expect(usePrefs.getState().tagFilter).toEqual(['r', 'b']);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(bars()).toEqual(['Task a', 'Task b', 'Task c']);
    expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
  });

  it('with no tags, focuses Clear so Escape still closes the popover', async () => {
    useRoadmap.getState().reset({ tags: [], tasks: [] });
    const user = userEvent.setup();
    render(<TagFilter />);
    await user.click(screen.getByRole('button', { name: 'Tags' }));
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not count filter ids of deleted tags', () => {
    usePrefs.setState({ tagFilter: ['r', 'gone'] });
    render(<TagFilter />);
    expect(screen.getByRole('button', { name: 'Tags (1)' })).toBeInTheDocument();
  });
});
