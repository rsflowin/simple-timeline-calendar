// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRoadmap } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { TaskHoverCard } from './TaskHoverCard';

describe('TaskHoverCard', () => {
  beforeEach(() => {
    useRoadmap.getState().reset({
      tags: [{ id: 'r', name: 'Urgent', color: 'red' }],
      tasks: [
        {
          id: 'a',
          title: 'A very long title that the bar cuts off',
          details: '',
          start: '2026-12-28',
          end: '2027-01-03',
          tagIds: ['r'],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    useUi.setState({ hover: null });
  });

  it('shows the full title, dates with years and tags of the hovered bar; hides on scroll', () => {
    render(<TaskHoverCard />);
    expect(screen.queryByText(/very long title/)).toBeNull();
    act(() => useUi.getState().setHover({ id: 'a', anchor: new DOMRect(10, 10, 20, 24) }));
    expect(screen.getByText('A very long title that the bar cuts off')).toBeInTheDocument();
    expect(screen.getByText('Dec 28, 2026 – Jan 3, 2027')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    act(() => {
      fireEvent.scroll(document);
    });
    expect(useUi.getState().hover).toBeNull();
    expect(screen.queryByText(/very long title/)).toBeNull();
  });
});
