// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
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
