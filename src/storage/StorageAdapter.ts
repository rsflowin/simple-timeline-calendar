export class ConflictError extends Error {
  constructor(message = 'Roadmap was modified elsewhere') {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface StorageAdapter {
  /** Raw saved JSON, or null when nothing has been saved yet. */
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
  /** Keep unreadable data somewhere safe before it gets overwritten. */
  backup(json: string): Promise<void>;
}
