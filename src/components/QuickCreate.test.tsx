// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_DOC } from '../domain/doc';
import { useRoadmap } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { QuickCreate } from './QuickCreate';

const tasks = () => useRoadmap.getState().history.present.tasks;
const anchor = { left: 100, top: 100, right: 160, bottom: 120, width: 60, height: 20 } as DOMRect;

function open() {
  render(<QuickCreate />);
  act(() => useUi.getState().openQuickCreate({ start: '2026-01-03', end: '2026-01-09', anchor }));
}

describe('QuickCreate', () => {
  beforeEach(() => {
    useRoadmap.getState().reset(EMPTY_DOC);
    useUi.setState({ quickCreate: null, editing: null });
  });

  it('shows the range and a focused title field', () => {
    open();
    expect(screen.getByRole('dialog')).toHaveTextContent('Jan 3 – Jan 9');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('Enter creates the task with the range dates and closes', async () => {
    open();
    await userEvent.keyboard('Launch{Enter}');
    expect(tasks()).toMatchObject([{ title: 'Launch', start: '2026-01-03', end: '2026-01-09' }]);
    expect(useUi.getState().quickCreate).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Enter with a blank title closes without creating', async () => {
    open();
    await userEvent.keyboard('  {Enter}');
    expect(tasks()).toHaveLength(0);
    expect(useUi.getState().quickCreate).toBeNull();
  });

  it('Esc closes without creating', async () => {
    open();
    await userEvent.keyboard('Launch{Escape}');
    expect(tasks()).toHaveLength(0);
    expect(useUi.getState().quickCreate).toBeNull();
  });

  it('clicking outside closes without creating', async () => {
    open();
    await userEvent.keyboard('Launch');
    await userEvent.click(document.body);
    expect(tasks()).toHaveLength(0);
    expect(useUi.getState().quickCreate).toBeNull();
  });

  it('More options opens the task dialog prefilled', async () => {
    open();
    await userEvent.keyboard('Launch');
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(useUi.getState().quickCreate).toBeNull();
    expect(useUi.getState().editing).toMatchObject({
      mode: 'new',
      draft: { title: 'Launch', start: '2026-01-03', end: '2026-01-09' },
    });
    expect(tasks()).toHaveLength(0);
  });
});
