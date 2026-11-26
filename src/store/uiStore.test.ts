// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { todayISO } from '../domain/dates';
import { usePrefs } from './prefsStore';
import { useUi } from './uiStore';

describe('uiStore.openNew', () => {
  afterEach(() => usePrefs.setState({ tagFilter: [] }));

  it('defaults the tags to the active filter, so the new task stays visible', () => {
    usePrefs.setState({ tagFilter: ['g'] });
    useUi.getState().openNew();
    expect(useUi.getState().editing).toMatchObject({ mode: 'new', draft: { tagIds: ['g'] } });
  });
});

describe('uiStore agenda date', () => {
  afterEach(() => {
    usePrefs.setState({ agendaOpen: false });
    useUi.setState({ agendaDate: todayISO(), peekId: null });
  });

  it('setAgendaDate updates the briefing date', () => {
    useUi.getState().setAgendaDate('2026-12-01');
    expect(useUi.getState().agendaDate).toBe('2026-12-01');
  });

  it('openAgendaFor sets agendaDate, clears peekId, and opens the agenda panel', () => {
    useUi.setState({ peekId: 'task-1' });
    usePrefs.setState({ agendaOpen: false });
    useUi.getState().openAgendaFor('2026-12-05');
    expect(useUi.getState().agendaDate).toBe('2026-12-05');
    expect(useUi.getState().peekId).toBeNull();
    expect(usePrefs.getState().agendaOpen).toBe(true);
  });

  it('openAgendaFor toggles agenda closed when clicking the already-selected date (unless peek is open)', () => {
    useUi.getState().openAgendaFor('2026-12-05');
    expect(usePrefs.getState().agendaOpen).toBe(true);

    useUi.getState().openAgendaFor('2026-12-05');
    expect(usePrefs.getState().agendaOpen).toBe(false);

    // If peek is open on the same agendaDate, clicking the date switches back to Agenda instead of closing
    usePrefs.setState({ agendaOpen: true });
    useUi.setState({ peekId: 'task-1' });
    useUi.getState().openAgendaFor('2026-12-05');
    expect(useUi.getState().peekId).toBeNull();
    expect(usePrefs.getState().agendaOpen).toBe(true);
  });

  it('ignores out-of-range or invalid dates in setAgendaDate and openAgendaFor', () => {
    useUi.getState().setAgendaDate('2026-12-01');
    useUi.getState().setAgendaDate('1899-12-31');
    useUi.getState().setAgendaDate('2200-01-01');
    useUi.getState().openAgendaFor('2026-02-30');
    expect(useUi.getState().agendaDate).toBe('2026-12-01');
    expect(usePrefs.getState().agendaOpen).toBe(false);
  });
});
