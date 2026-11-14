// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayISO } from '../../domain/dates';
import { serializeRoadmap } from '../../domain/schema';
import type { RoadmapDoc } from '../../domain/types';
import { downloadText, pickTextFile } from '../../storage/fileTransfer';
import { useRoadmap } from '../../store/roadmapStore';
import { useStatus } from '../../store/statusStore';
import { StatusBanner } from '../StatusBanner';
import { Toolbar } from './Toolbar';

vi.mock('../../storage/fileTransfer', () => ({ downloadText: vi.fn(), pickTextFile: vi.fn() }));

const before: RoadmapDoc = { tags: [], tasks: [] };
const imported: RoadmapDoc = {
  tags: [{ id: 'g', name: 'Growth', color: 'green' }],
  tasks: [
    {
      id: 't',
      title: 'Launch',
      details: '',
      start: '2026-01-05',
      end: '2026-01-09',
      tagIds: ['g'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};
const present = () => useRoadmap.getState().history.present;

async function chooseFromMenu(item: string) {
  const user = userEvent.setup();
  render(
    <>
      <Toolbar onToday={() => {}} />
      <StatusBanner />
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: item }));
}

describe('Toolbar menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoadmap.getState().reset(before);
    useStatus.getState().clear();
  });

  it('Export downloads the roadmap as roadmap-<today>.json', async () => {
    useRoadmap.getState().reset(imported);
    await chooseFromMenu('Export JSON');
    expect(downloadText).toHaveBeenCalledWith(
      serializeRoadmap(imported),
      `roadmap-${todayISO()}.json`,
    );
  });

  it('Import replaces the roadmap as one undo step and confirms', async () => {
    vi.mocked(pickTextFile).mockResolvedValue(serializeRoadmap(imported));
    await chooseFromMenu('Import JSON');
    expect(await screen.findByRole('alert')).toHaveTextContent('Imported 1 task and 1 tag.');
    expect(present()).toEqual(imported);

    useRoadmap.getState().undo();
    expect(present()).toBe(before);
  });

  it('Import of an invalid file shows the error and changes nothing', async () => {
    const bad = JSON.parse(serializeRoadmap(imported));
    bad.tasks[0].end = '2026-01-01';
    vi.mocked(pickTextFile).mockResolvedValue(JSON.stringify(bad));
    await chooseFromMenu('Import JSON');
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Import failed: tasks\[0\]\.end/);
    expect(present()).toBe(before);
    expect(useRoadmap.getState().history.past).toEqual([]);
  });

  it('a cancelled file picker does nothing', async () => {
    vi.mocked(pickTextFile).mockResolvedValue(null);
    await chooseFromMenu('Import JSON');
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(present()).toBe(before);
  });
});
