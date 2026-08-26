import { openDB, type IDBPDatabase } from 'idb'

export type DraftResourceType = 'entity' | 'session' | 'plot_thread'

export interface ResourceDraft {
  key: string
  resourceType: DraftResourceType
  campaignId: string
  resourceId: string | null
  savedAt: string
  data: Record<string, unknown>
}

const DB_NAME = 'worldbinder-drafts'
const STORE_NAME = 'entity-drafts'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Same store, just a new (optional, since IndexedDB is schemaless per
      // row) `resourceType` field on new writes — existing entity-only rows
      // from schema version 1 are left as-is, not migrated.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    },
  })
  return dbPromise
}

function draftKey(
  resourceType: DraftResourceType,
  campaignId: string,
  resourceId: string | null,
): string {
  return `${resourceType}:${campaignId}:${resourceId ?? 'new'}`
}

export async function saveDraft(
  resourceType: DraftResourceType,
  campaignId: string,
  resourceId: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, {
    key: draftKey(resourceType, campaignId, resourceId),
    resourceType,
    campaignId,
    resourceId,
    savedAt: new Date().toISOString(),
    data,
  } satisfies ResourceDraft)
}

export async function loadDraft(
  resourceType: DraftResourceType,
  campaignId: string,
  resourceId: string | null,
): Promise<ResourceDraft | undefined> {
  const db = await getDb()
  return db.get(STORE_NAME, draftKey(resourceType, campaignId, resourceId)) as Promise<
    ResourceDraft | undefined
  >
}

export async function clearDraft(
  resourceType: DraftResourceType,
  campaignId: string,
  resourceId: string | null,
): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, draftKey(resourceType, campaignId, resourceId))
}
