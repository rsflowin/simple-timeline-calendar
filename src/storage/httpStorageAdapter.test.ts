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

  it('enables keepalive only when requested and UTF-8 byte length stays within 60 KB', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('{"revision":"\\"r1\\""}', { status: 200, headers: { ETag: '"r1"' } }),
      )
      .mockResolvedValueOnce(
        new Response('{"revision":"\\"r2\\""}', { status: 200, headers: { ETag: '"r2"' } }),
      )
      .mockResolvedValueOnce(
        new Response('{"revision":"\\"r3\\""}', { status: 200, headers: { ETag: '"r3"' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    // 25,000 Korean characters = 25,000 UTF-16 chars (<= 60,000) but 75,000 UTF-8 bytes (> 64 KiB)
    const largePayload = JSON.stringify({ text: '가'.repeat(25_000) });
    expect(largePayload.length).toBeLessThan(60_000);
    expect(new TextEncoder().encode(largePayload).byteLength).toBeGreaterThan(65_536);

    const adapter = httpStorageAdapter();
    await adapter.save('{"v":1}');
    expect(fetchMock.mock.calls[0][1]?.keepalive).toBe(false);

    await adapter.save('{"v":2}', { keepalive: true });
    expect(fetchMock.mock.calls[1][1]?.keepalive).toBe(true);

    await adapter.save(largePayload, { keepalive: true });
    expect(fetchMock.mock.calls[2][1]?.keepalive).toBe(false);
  });

  it('drains the PUT response body so repeated keepalive saves release quota', async () => {
    const r1 = new Response('{"revision":"\\"r1\\""}', { status: 200, headers: { ETag: '"r1"' } });
    const r2 = new Response('{"revision":"\\"r2\\""}', { status: 200, headers: { ETag: '"r2"' } });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(r1).mockResolvedValueOnce(r2);
    vi.stubGlobal('fetch', fetchMock);

    const adapter = httpStorageAdapter();
    await adapter.save('{"v":1}', { keepalive: true });
    await adapter.save('{"v":2}', { keepalive: true });

    expect(r1.bodyUsed).toBe(true);
    expect(r2.bodyUsed).toBe(true);
  });

  it('serializes overlapping saves so the second sees the updated ETag', async () => {
    let resolveFirst!: (res: Response) => void;
    const firstPromise = new Promise<Response>((r) => {
      resolveFirst = r;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(
        new Response('{"revision":"\\"r2\\""}', { status: 200, headers: { ETag: '"r2"' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = httpStorageAdapter();
    const p1 = adapter.save('{"v":1}');
    const p2 = adapter.save('{"v":2}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['If-None-Match']).toBe(
      '*',
    );

    resolveFirst(
      new Response('{"revision":"\\"r1\\""}', { status: 200, headers: { ETag: '"r1"' } }),
    );
    await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)['If-Match']).toBe(
      '"r1"',
    );
  });
});
