export class ConflictError extends Error {
  constructor(message = 'Roadmap was modified elsewhere') {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface SaveOptions {
  /** Use browser keepalive when saving during page hide/unload so the request survives navigation. */
  keepalive?: boolean;
}

export interface StorageAdapter {
  /** Raw saved JSON, or null when nothing has been saved yet. */
  load(): Promise<string | null>;
  save(json: string, options?: SaveOptions): Promise<void>;
  /** Keep unreadable data somewhere safe before it gets overwritten. */
  backup(json: string): Promise<void>;
}
