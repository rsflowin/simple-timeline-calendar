// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoadmapDoc, Task } from '../domain/types';
import * as fileTransfer from '../storage/fileTransfer';
import { usePrefs } from '../store/prefsStore';
import { useRoadmap } from '../store/roadmapStore';
import { ExportDialog } from './ExportDialog';

const task = (id: string, start: string, end: string, tagIds: string[]): Task => ({
  id,
  title: id,
  details: '',
  start,
  end,
  tagIds,
  createdAt: '',
  updatedAt: '',
});

const doc: RoadmapDoc = {
  tags: [
    { id: 'r', name: 'Urgent', color: 'red' },
    { id: 'b', name: 'Backend', color: 'blue' },
  ],
  tasks: [
    task('t1', '2026-01-05', '2026-01-09', ['r']),
    task('t2', '2026-03-01', '2026-03-02', ['b']),
  ],
};

describe('ExportDialog', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(doc);
    usePrefs.getState().set({ tagFilter: [] });
  });

  const count = () => screen.getByText(/will be exported/);

  it('counts tasks by date range and tags', async () => {
    const user = userEvent.setup();
    render(<ExportDialog open onClose={() => {}} />);
    expect(count()).toHaveTextContent('2 tasks');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-02-01' } });
    expect(count()).toHaveTextContent('1 task ');

    await user.click(screen.getByRole('checkbox', { name: 'Urgent' }));
    expect(count()).toHaveTextContent('0 tasks');
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('rejects From after To', () => {
    render(<ExportDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-04-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('From must be on or before To');
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('starts from the toolbar tag filter and downloads an .ics', async () => {
    usePrefs.getState().set({ tagFilter: ['b', 'deleted'] });
    const download = vi.spyOn(fileTransfer, 'downloadText').mockImplementation(() => {});
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExportDialog open onClose={onClose} />);
    expect(screen.getByRole('checkbox', { name: 'Backend' })).toBeChecked();
    expect(count()).toHaveTextContent('1 task ');

    await user.click(screen.getByRole('radio', { name: /iCalendar/ }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const [text, name, type] = download.mock.calls[0];
    expect(text).toContain('UID:t2@timeline-calendar');
    expect(text).not.toContain('UID:t1@');
    expect(name).toMatch(/^roadmap-\d{4}-\d{2}-\d{2}\.ics$/);
    expect(type).toBe('text/calendar');
    expect(onClose).toHaveBeenCalled();
  });

  it('exports filtered JSON that keeps every tag', async () => {
    const download = vi.spyOn(fileTransfer, 'downloadText').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ExportDialog open onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: /JSON/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-31' } });

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const [text, name] = download.mock.calls[0];
    const json = JSON.parse(text);
    expect(json.tasks.map((t: Task) => t.id)).toEqual(['t1']);
    expect(json.tags).toEqual(doc.tags);
    expect(name).toMatch(/^roadmap-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
