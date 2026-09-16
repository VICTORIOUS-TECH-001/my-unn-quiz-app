import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  INITIAL_CONFIG,
  INITIAL_COURSES,
  INITIAL_NOTIFICATIONS,
  INITIAL_QUIZZES,
  INITIAL_RESULTS,
  INITIAL_STUDENTS,
} from '../src/services/seedData';

export type StorageResource =
  | 'students'
  | 'courses'
  | 'quizzes'
  | 'attempts'
  | 'results'
  | 'notifications'
  | 'config';

export const storageResources = new Set<StorageResource>([
  'students',
  'courses',
  'quizzes',
  'attempts',
  'results',
  'notifications',
  'config',
]);

const dataDirectory = path.resolve(process.cwd(), 'server', 'data');
const writeQueues = new Map<StorageResource, Promise<void>>();
const defaults: Record<StorageResource, unknown> = {
  students: INITIAL_STUDENTS,
  courses: INITIAL_COURSES,
  quizzes: INITIAL_QUIZZES,
  attempts: {},
  results: INITIAL_RESULTS,
  notifications: INITIAL_NOTIFICATIONS,
  config: INITIAL_CONFIG,
};

function fileFor(resource: StorageResource): string {
  return path.join(dataDirectory, `${resource}.json`);
}

export async function initializeJsonStore(): Promise<void> {
  await fs.mkdir(dataDirectory, { recursive: true });
  await Promise.all(
    (Object.keys(defaults) as StorageResource[]).map(async (resource) => {
      try {
        await fs.access(fileFor(resource));
      } catch {
        await writeJson(resource, defaults[resource]);
      }
    })
  );
}

export async function readJson(resource: StorageResource): Promise<unknown> {
  const content = await fs.readFile(fileFor(resource), 'utf8');
  return JSON.parse(content);
}

export function isStorageResource(value: string): value is StorageResource {
  return storageResources.has(value as StorageResource);
}

export async function writeJson(resource: StorageResource, value: unknown): Promise<void> {
  const previousWrite = writeQueues.get(resource) || Promise.resolve();
  const nextWrite = previousWrite.then(async () => {
    const temporaryFile = `${fileFor(resource)}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, fileFor(resource));
  });
  writeQueues.set(resource, nextWrite);
  try {
    await nextWrite;
  } finally {
    if (writeQueues.get(resource) === nextWrite) writeQueues.delete(resource);
  }
}
