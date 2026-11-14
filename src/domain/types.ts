import type { ISODate } from './dates';

/** Rotation order for new tags — first tag gets blue, not gray. */
export const TAG_COLORS = [
  'blue',
  'green',
  'orange',
  'purple',
  'pink',
  'red',
  'yellow',
  'brown',
  'gray',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

export interface Task {
  id: string;
  title: string;
  details: string;
  start: ISODate;
  /** Inclusive. */
  end: ISODate;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** The undoable document. */
export interface RoadmapDoc {
  tasks: Task[];
  tags: Tag[];
}

export const FILE_FORMAT = 'timeline-calendar';
export const FILE_VERSION = 1;

export const LIMITS = { title: 200, details: 10_000, tagName: 50, id: 100 } as const;
