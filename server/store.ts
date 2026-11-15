export interface StoredRoadmap {
  json: string;
  revision: string;
}

export class StoreConflictError extends Error {
  constructor(message = 'Roadmap was modified elsewhere') {
    super(message);
    this.name = 'StoreConflictError';
  }
}

export interface RoadmapStore {
  load(roadmapId: string): Promise<StoredRoadmap | null>;
  /**
   * `expectedRevision`:
   * - `undefined`: unconditional write
   * - `null`: write only if no roadmap exists yet
   * - `string`: write only if current revision matches
   */
  save(roadmapId: string, json: string, expectedRevision?: string | null): Promise<StoredRoadmap>;
  backup(roadmapId: string, json: string): Promise<void>;
}

const VALID_ID = /^[a-zA-Z0-9_-]{1,64}$/;

export function assertValidRoadmapId(id: string): string {
  if (!VALID_ID.test(id)) throw new Error(`Invalid roadmap id: ${id}`);
  return id;
}
