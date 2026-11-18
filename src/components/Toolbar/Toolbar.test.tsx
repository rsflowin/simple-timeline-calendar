// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayISO } from '../../domain/dates';
import { serializeRoadmap } from '../../domain/schema';
import type { RoadmapDoc } from '../../domain/types';
import { downloadText, pickTextFile } from '../../storage/fileTransfer';
import { usePrefs } from '../../store/prefsStore';
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
    usePrefs.setState({
      packRows: true,
      tagRowMode: 'dedicated',
      clickCreate: true,
      dragBehavior: 'task',
    });
  });

  it('Export downloads the roadmap as roadmap-<today>.json', async () => {
    useRoadmap.getState().reset(imported);
    await chooseFromMenu('Export JSON');
    expect(downloadText).toHaveBeenCalledWith(
      serializeRoadmap(imported),
      `roadmap-${todayISO()}.json`,
    );
  });

  it('Export .ics opens the export dialog', async () => {
    await chooseFromMenu('Export .ics');
    expect(screen.getByRole('dialog', { name: 'Export .ics' })).toBeInTheDocument();
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

  it('Menu lists Manage tags, Tag display, Mouse & drag, Export JSON, Import JSON in order and removes Preferences button', async () => {
    usePrefs.setState({ packRows: true, tagRowMode: 'dedicated' });
    const user = userEvent.setup();
    render(<Toolbar onToday={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Preferences' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const menuDialog = screen.getByRole('dialog', { name: 'Menu' });
    const labels = [...menuDialog.querySelectorAll('button')].map(
      (b) => b.firstElementChild?.textContent,
    );
    expect(labels).toEqual([
      'Manage tags',
      'Tag display',
      'Mouse & drag',
      'Export JSON',
      'Export .ics',
      'Import JSON',
    ]);

    await user.click(screen.getByRole('button', { name: /Tag display/ }));
    const dedicated = screen.getByRole('radio', { name: /Dedicated lines per tag/ });
    const compact = screen.getByRole('radio', { name: /Tag-first compact packing/ });
    expect(dedicated).toBeChecked();
    expect(compact).not.toBeChecked();

    await user.click(compact);
    expect(usePrefs.getState().tagRowMode).toBe('compact');
    expect(compact).toBeChecked();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Tag display/ })).toHaveTextContent('Compact');

    await user.click(screen.getByRole('button', { name: 'Manage tags' }));
    expect(screen.getByRole('dialog', { name: 'Manage tags' })).toBeInTheDocument();
  });

  it('configures click-to-create and drag behavior in Mouse & drag submenu', async () => {
    const user = userEvent.setup();
    render(<Toolbar onToday={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: /Mouse & drag/ })).toHaveTextContent('Tasks');

    await user.click(screen.getByRole('button', { name: /Mouse & drag/ }));
    const clickToggle = screen.getByRole('checkbox', { name: /Click empty space to create/ });
    const dragScroll = screen.getByRole('radio', { name: /Move scroll/ });
    const dragTask = screen.getByRole('radio', { name: /Move task or create new task/ });

    expect(clickToggle).toBeChecked();
    expect(screen.getByRole('radio', { name: /Do nothing/ })).not.toBeChecked();
    expect(dragScroll).not.toBeChecked();
    expect(dragTask).toBeChecked();

    await user.click(clickToggle);
    expect(usePrefs.getState().clickCreate).toBe(false);
    expect(clickToggle).not.toBeChecked();

    await user.click(dragScroll);
    expect(usePrefs.getState().dragBehavior).toBe('scroll');
    expect(dragScroll).toBeChecked();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Mouse & drag/ })).toHaveTextContent('Scroll');

    await user.click(screen.getByRole('button', { name: /Mouse & drag/ }));
    await user.click(screen.getByRole('radio', { name: /Do nothing/ }));
    expect(usePrefs.getState().dragBehavior).toBe('none');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Mouse & drag/ })).toHaveTextContent('Off');
  });

  it('shows a hint in Tag display submenu when Pack rows is off', async () => {
    usePrefs.setState({ packRows: false, tagRowMode: 'dedicated' });
    const user = userEvent.setup();
    render(<Toolbar onToday={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /Tag display/ }));
    expect(screen.getByText('Applies when Pack rows is enabled.')).toBeInTheDocument();
  });
});
