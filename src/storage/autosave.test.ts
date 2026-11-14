import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTask, EMPTY_DOC } from '../domain/doc';
import { parseRoadmap } from '../domain/schema';
import { useRoadmap } from '../store/roadmapStore';
import { startAutosave } from './autosave';

const input = { title: 'A', details: '', start: '2026-01-05', end: '2026-01-06', tagIds: [] };

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoadmap.getState().reset(EMPTY_DOC);
  });
  afterEach(() => vi.useRealTimers());

  it('saves once, 300 ms after the last change', async () => {
    const save = vi.fn<(json: string) => Promise<void>>(async () => {});
    const stop = startAutosave({ load: async () => null, save, backup: async () => {} }, () => {});
    useRoadmap.getState().commit((d) => addTask(d, input));
    useRoadmap.getState().commit((d) => addTask(d, input));
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledTimes(1);
    expect(parseRoadmap(save.mock.calls[0][0]).tasks).toHaveLength(2);
    stop();
  });

  it('saves at once when the page is hidden, and only if something is pending', () => {
    let onHide = () => {};
    vi.stubGlobal('addEventListener', (type: string, fn: () => void) => {
      if (type === 'pagehide') onHide = fn;
    });
    try {
      const save = vi.fn<(json: string) => Promise<void>>(async () => {});
      const stop = startAutosave(
        { load: async () => null, save, backup: async () => {} },
        () => {},
      );
      useRoadmap.getState().commit((d) => addTask(d, input));
      onHide();
      expect(save).toHaveBeenCalledTimes(1);
      onHide();
      expect(save).toHaveBeenCalledTimes(1);
      stop();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports save errors', async () => {
    const onError = vi.fn();
    const stop = startAutosave(
      {
        load: async () => null,
        save: async () => {
          throw new Error('quota');
        },
        backup: async () => {},
      },
      onError,
    );
    useRoadmap.getState().commit((d) => addTask(d, input));
    await vi.advanceTimersByTimeAsync(300);
    expect(onError).toHaveBeenCalled();
    stop();
  });
});
