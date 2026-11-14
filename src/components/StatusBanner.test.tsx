// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatus } from '../store/statusStore';
import { StatusBanner } from './StatusBanner';

vi.mock('../storage/fileTransfer', () => ({ downloadText: vi.fn() }));

describe('StatusBanner while the unreadable data has no backup (DATA-5)', () => {
  const startSaving = vi.fn();
  beforeEach(() => {
    startSaving.mockClear();
    useStatus.setState({ message: 'no backup could be written', unreadable: 'raw', startSaving });
    render(<StatusBanner />);
  });

  it('cannot be dismissed', () => {
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('Download backup starts saving once', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(startSaving).toHaveBeenCalledTimes(1);
  });

  it('Start fresh starts saving once', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(startSaving).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Start fresh' })).not.toBeInTheDocument();
  });
});
