import { beforeEach, describe, expect, it } from 'vitest';
import { useStatus } from './statusStore';

const status = () => useStatus.getState();

describe('statusStore', () => {
  beforeEach(() => status().clear());

  it('keeps the unreadable backup text across later messages until cleared', () => {
    status().show('bad', 'raw');
    status().show('Imported 1 task and 0 tags.');
    expect(status()).toMatchObject({ message: 'Imported 1 task and 0 tags.', unreadable: 'raw' });

    status().clear();
    expect(status()).toMatchObject({ message: null, unreadable: null });
  });

  it('drops the backup text when null is passed explicitly', () => {
    status().show('bad', 'raw');
    status().show('ok', null);
    expect(status().unreadable).toBeNull();
  });
});
