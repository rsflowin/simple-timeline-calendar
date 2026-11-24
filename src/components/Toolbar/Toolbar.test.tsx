// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayISO } from '../../domain/dates';
import { serializeRoadmap } from '../../domain/schema';
import type { RoadmapDoc } from '../../domain/types';
import { downloadText, pickTextFile } from '../../storage/fileTransfer';
import { usePrefs } from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
import { useStatus } from '../../store/statusStore';
import { useUi } from '../../store/uiStore';
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

async function chooseFromMenu(item: RegExp) {
  const user = userEvent.setup();
  render(
    <>
      <Toolbar onToday={() => {}} onStep={() => {}} />
      <StatusBanner />
    </>,
  );
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: item }));
  return user;
}

async function importFromMenu(mode: 'Add' | 'Replace' = 'Add') {
  const user = await chooseFromMenu(/^Import…/);
  const dialog = screen.getByRole('dialog', { name: 'Import' });
  await user.click(within(dialog).getByRole('radio', { name: new RegExp(`^${mode}`) }));
  await user.click(within(dialog).getByRole('button', { name: 'Choose file…' }));
  return dialog;
}

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:t@timeline-calendar',
  'DTSTART;VALUE=DATE:20260105',
  'DTEND;VALUE=DATE:20260110',
  'SUMMARY:Launch',
  'CATEGORIES:Growth',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

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
      tagFilter: [],
    });
  });

  it('Export with defaults downloads the whole roadmap as roadmap-<today>.json', async () => {
    useRoadmap.getState().reset(imported);
    const user = await chooseFromMenu(/^Export…/);
    const dialog = screen.getByRole('dialog', { name: 'Export' });
    await user.click(within(dialog).getByRole('button', { name: 'Export' }));
    expect(downloadText).toHaveBeenCalledWith(
      serializeRoadmap(imported),
      `roadmap-${todayISO()}.json`,
    );
  });

  it('Import of an .ics merges events into the roadmap as one undo step', async () => {
    vi.mocked(pickTextFile).mockResolvedValue(ics);
    await importFromMenu();
    expect(await screen.findByRole('alert')).toHaveTextContent('Imported: 1 added, 0 updated.');
    expect(present().tasks).toEqual([
      expect.objectContaining({ id: 't', title: 'Launch', start: '2026-01-05', end: '2026-01-09' }),
    ]);
    expect(present().tags.map((t) => t.name)).toEqual(['Growth']);
    expect(pickTextFile).toHaveBeenCalledWith('.json,.ics,application/json,text/calendar');

    useRoadmap.getState().undo();
    expect(present()).toBe(before);
  });

  it('JSON import adds new tasks and leaves existing tasks and tags untouched, as one undo step', async () => {
    const existing: RoadmapDoc = {
      tags: [{ id: 'old', name: 'Old', color: 'red' }],
      tasks: [{ ...imported.tasks[0], id: 'keep', title: 'Keep me', tagIds: ['old'] }],
    };
    useRoadmap.getState().reset(existing);
    vi.mocked(pickTextFile).mockResolvedValue(serializeRoadmap(imported));
    await importFromMenu();
    expect(await screen.findByRole('alert')).toHaveTextContent('Imported: 1 added, 0 updated.');
    expect(present().tasks[0]).toBe(existing.tasks[0]);
    expect(present().tags).toEqual([...existing.tags, ...imported.tags]);
    expect(present().tasks[1]).toMatchObject({ id: 't', title: 'Launch', tagIds: ['g'] });

    useRoadmap.getState().undo();
    expect(present()).toBe(existing);
  });

  it('Import of an invalid file shows the error and changes nothing', async () => {
    const bad = JSON.parse(serializeRoadmap(imported));
    bad.tasks[0].end = '2026-01-01';
    vi.mocked(pickTextFile).mockResolvedValue(JSON.stringify(bad));
    await importFromMenu();
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Import failed: tasks\[0\]\.end/);
    expect(present()).toBe(before);
    expect(useRoadmap.getState().history.past).toEqual([]);
  });

  it('a cancelled file picker does nothing and keeps the dialog open', async () => {
    vi.mocked(pickTextFile).mockResolvedValue(null);
    const dialog = await importFromMenu();
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(present()).toBe(before);
    expect(dialog).toHaveAttribute('open');
  });

  it('Replace swaps the whole roadmap for a JSON file as one undo step', async () => {
    const existing: RoadmapDoc = {
      tags: [{ id: 'old', name: 'Old', color: 'red' }],
      tasks: [{ ...imported.tasks[0], id: 'gone', tagIds: ['old'] }],
    };
    useRoadmap.getState().reset(existing);
    vi.mocked(pickTextFile).mockResolvedValue(serializeRoadmap(imported));
    const dialog = await importFromMenu('Replace');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Replaced the roadmap with 1 task and 1 tag.',
    );
    expect(present()).toEqual(imported);
    expect(dialog).not.toHaveAttribute('open');

    useRoadmap.getState().undo();
    expect(present()).toBe(existing);
  });

  it('Replace with an .ics keeps only its events', async () => {
    useRoadmap.getState().reset({
      tags: [{ id: 'old', name: 'Old', color: 'red' }],
      tasks: [{ ...imported.tasks[0], id: 'gone', tagIds: ['old'] }],
    });
    vi.mocked(pickTextFile).mockResolvedValue(ics);
    await importFromMenu('Replace');
    expect(await screen.findByRole('alert')).toHaveTextContent('1 task and 1 tag');
    expect(present().tasks.map((t) => t.id)).toEqual(['t']);
    expect(present().tags.map((t) => t.name)).toEqual(['Growth']);
  });

  it('Menu lists Manage tags, Mouse & drag, Keyboard shortcuts, Export…, Import… in order', async () => {
    const user = userEvent.setup();
    render(<Toolbar onToday={() => {}} onStep={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Preferences' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Menu' }));

    const menuDialog = screen.getByRole('dialog', { name: 'Menu' });
    const labels = [...menuDialog.querySelectorAll('button')].map(
      (b) => b.firstElementChild?.textContent,
    );
    expect(labels).toEqual([
      'Manage tags',
      'Mouse & drag',
      'Keyboard shortcuts',
      'Export…',
      'Import…',
    ]);

    await user.click(screen.getByRole('button', { name: /Keyboard shortcuts/ }));
    expect(useUi.getState().shortcutsOpen).toBe(true);
    useUi.setState({ shortcutsOpen: false });

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'Manage tags' }));
    expect(screen.getByRole('dialog', { name: 'Manage tags' })).toBeInTheDocument();
  });

  it('Display sets Pack rows, tag rows and tag headers', async () => {
    usePrefs.setState({ packRows: true, tagRowMode: 'dedicated', groupLabels: true });
    const user = userEvent.setup();
    render(<Toolbar onToday={() => {}} onStep={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Display' }));
    const perTag = screen.getByRole('radio', { name: /One row per tag/ });
    const together = screen.getByRole('radio', { name: /Pack tags together/ });
    const headers = screen.getByRole('checkbox', { name: /Show tag headers/ });
    expect(perTag).toBeChecked();
    expect(headers).toBeChecked();
    expect(headers).toBeEnabled();

    await user.click(headers);
    expect(usePrefs.getState().groupLabels).toBe(false);
    await user.click(together);
    expect(usePrefs.getState().tagRowMode).toBe('compact');
    expect(headers).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Pack rows/ }));
    expect(usePrefs.getState().packRows).toBe(false);
    expect(perTag).toBeDisabled();
    expect(screen.getByText('Tag headers need Pack rows and One row per tag.')).toBeInTheDocument();
  });

  it('configures click-to-create and drag behavior in Mouse & drag submenu', async () => {
    const user = userEvent.setup();
    render(<Toolbar onToday={() => {}} onStep={() => {}} />);

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

  it('‹ Today › step and jump, and the title follows the view', async () => {
    const steps: number[] = [];
    let today = 0;
    usePrefs.setState({ view: 'timeline' });
    useUi.setState({ timelineTitle: 'November 2026' });
    const user = userEvent.setup();
    render(<Toolbar onToday={() => today++} onStep={(d) => steps.push(d)} />);
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous period' }));
    await user.click(screen.getByRole('button', { name: 'Next period' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(steps).toEqual([-1, 1]);
    expect(today).toBe(1);
    act(() => usePrefs.setState({ view: 'calendar', calendarMode: 'year', cursor: '2026-11-13' }));
    expect(screen.getByRole('button', { name: 'Next year' })).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
  });
});
