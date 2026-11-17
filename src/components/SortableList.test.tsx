// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SortableList } from './SortableList';

interface Item {
  id: string;
  name: string;
}

const initial: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

function mockRowRects(list: HTMLElement, rowHeight = 40) {
  const items = [...list.querySelectorAll('li')];
  items.forEach((li, i) => {
    li.getBoundingClientRect = () => new DOMRect(0, i * rowHeight, 300, rowHeight);
  });
}

function Harness({
  onReorder = vi.fn(),
  startItems = initial,
}: {
  onReorder?(ids: string[]): void;
  startItems?: Item[];
}) {
  const [items, setItems] = useState(startItems);
  return (
    <SortableList
      items={items}
      label="Items"
      itemLabel={(x) => x.name}
      onReorder={(ids) => {
        onReorder(ids);
        const byId = new Map(items.map((x) => [x.id, x]));
        setItems(ids.map((id) => byId.get(id)!));
      }}
      renderItem={(item, handle) => (
        <div>
          {handle}
          <span>{item.name}</span>
        </div>
      )}
    />
  );
}

const labels = () => screen.getAllByRole('listitem').map((li) => li.textContent);

describe('SortableList', () => {
  it('reorders via pointer drag past sibling midpoints and commits once on drop', () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const list = screen.getByRole('list', { name: 'Items' });
    mockRowRects(list, 40); // midpoints: 20, 60, 100

    const alphaHandle = screen.getByRole('button', { name: 'Reorder Alpha' });
    fireEvent.pointerDown(alphaHandle, { button: 0, clientX: 10, clientY: 20 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 70 }));
    });
    expect(labels()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(onReorder).not.toHaveBeenCalled();

    mockRowRects(list, 40);
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 110 }));
    });
    expect(labels()).toEqual(['Beta', 'Gamma', 'Alpha']);
    expect(onReorder).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 110 }));
    });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
    expect(labels()).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('reorders upward via pointer drag', () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const list = screen.getByRole('list', { name: 'Items' });
    mockRowRects(list, 40); // midpoints: 20, 60, 100

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder Gamma' }), {
      button: 0,
      clientX: 10,
      clientY: 100,
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));
    });
    expect(labels()).toEqual(['Gamma', 'Alpha', 'Beta']);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 10 }));
    });
    expect(onReorder).toHaveBeenCalledWith(['c', 'a', 'b']);
  });

  it('does not reorder when pointer moves less than threshold or returns to start slot', () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const list = screen.getByRole('list', { name: 'Items' });
    mockRowRects(list, 40);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder Alpha' }), {
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 22 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 22 }));
    });
    expect(onReorder).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder Alpha' }), {
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 70 }));
    });
    expect(labels()).toEqual(['Beta', 'Alpha', 'Gamma']);
    mockRowRects(list, 40);
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 10 }));
    });
    expect(labels()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('cancels on Escape, reverts order, and suppresses dialog cancel', () => {
    const onReorder = vi.fn();
    const { container } = render(
      <dialog open>
        <Harness onReorder={onReorder} />
      </dialog>,
    );
    const dialog = container.querySelector('dialog')!;
    const list = screen.getByRole('list', { name: 'Items' });
    mockRowRects(list, 40);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder Alpha' }), {
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 70 }));
    });
    expect(labels()).toEqual(['Beta', 'Alpha', 'Gamma']);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    const cancelEv = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEv);
    expect(cancelEv.defaultPrevented).toBe(true);
    expect(labels()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('reorders with ArrowDown / ArrowUp and preserves focus on the handle', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);

    const betaHandle = screen.getByRole('button', { name: 'Reorder Beta' });
    betaHandle.focus();
    await user.keyboard('{ArrowUp}');
    expect(labels()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c']);
    expect(screen.getByRole('button', { name: 'Reorder Beta' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(labels()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(onReorder).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    expect(screen.getByRole('button', { name: 'Reorder Beta' })).toHaveFocus();
  });

  it('disables the drag handle when fewer than two items exist', () => {
    render(<Harness startItems={[{ id: 'a', name: 'Only' }]} />);
    expect(screen.getByRole('button', { name: 'Reorder Only' })).toBeDisabled();
  });
});
