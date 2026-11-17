import type { IncomingMessage } from 'node:http';

export interface Actor {
  userId: string;
  roadmapId: string;
}

export type ActorResolver = (req: IncomingMessage) => Promise<Actor | null>;

/**
 * Auth seam for future login support. Currently permits unauthenticated LAN
 * access to the shared `'default'` roadmap; returning `null` rejects with 401.
 */
export const resolveActor: ActorResolver = async () => ({
  userId: 'anonymous',
  roadmapId: 'default',
});
