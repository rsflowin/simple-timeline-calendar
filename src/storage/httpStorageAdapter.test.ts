import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from './StorageAdapter';
import { httpStorageAdapter } from './httpStorageAdapter';

describe('httpStorageAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns null on 204 and sends If-None-Match: * on initial save', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('{"revision":"\\"abc\\""}', { status: 200, headers: { ETag: '"abc"' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = httpStorageAdapter();
    expect(await adapter.load()).toBeNull();
    await adapter.save('{"tasks":[]}');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/roadmap');
    expect(init?.method).toBe('PUT');
    expect((init?.headers as Record<string, string>)['If-None-Match']).toBe('*');
  });

  it('tracks ETag across load and save and throws ConflictError on 409', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"v":1}', { status: 200, headers: { ETag: '"r1"' } }))
      .mockResolvedValueOnce(
        new Response('{"revision":"\\"r2\\""}', { status: 200, headers: { ETag: '"r2"' } }),
      )
      .mockResolvedValueOnce(new Response('{"error":"conflict"}', { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = httpStorageAdapter('http://localhost:8080');
    expect(await adapter.load()).toBe('{"v":1}');

    await adapter.save('{"v":2}');
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8080/api/roadmap');
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)['If-Match']).toBe(
      '"r1"',
    );

    await expect(adapter.save('{"v":3}')).rejects.toThrow(ConflictError);
    expect((fetchMock.mock.calls[2][1]?.headers as Record<string, string>)['If-Match']).toBe(
      '"r2"',
    );
  });

  it('posts backup payloads to /api/roadmap/backup', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = httpStorageAdapter();
    await adapter.backup('{broken');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/roadmap/backup',
      expect.objectContaining({ method: 'POST', body: '{broken' }),
    );
  });
});
