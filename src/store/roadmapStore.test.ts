import { beforeEach, describe, expect, it } from 'vitest';
import { addTask, EMPTY_DOC } from '../domain/doc';
import { useRoadmap } from './roadmapStore';

const input = { title: 'A', details: '', start: '2026-01-05', end: '2026-01-06', tagIds: [] };
const tasks = () => useRoadmap.getState().history.present.tasks;

describe('roadmapStore', () => {
  beforeEach(() => useRoadmap.getState().reset(EMPTY_DOC));

  it('commits, undoes and redoes', () => {
    useRoadmap.getState().commit((d) => addTask(d, input));
    expect(tasks()).toHaveLength(1);
    useRoadmap.getState().undo();
    expect(tasks()).toHaveLength(0);
    useRoadmap.getState().redo();
    expect(tasks()).toHaveLength(1);
  });

  it('a failed commit changes nothing', () => {
    const before = useRoadmap.getState().history;
    expect(() =>
      useRoadmap.getState().commit((d) => addTask(d, { ...input, title: '' })),
    ).toThrow();
    expect(useRoadmap.getState().history).toBe(before);
  });
});
