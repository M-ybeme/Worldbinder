import { openDB, type IDBPDatabase } from 'idb'

export interface EntityDraft {
  key: string
  campaignId: string
  entityId: string | null
  savedAt: string
  data: Record<string, unknown>
}

const DB_NAME = 'worldbinder-drafts'
const STORE_NAME = 'entity-drafts'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    },
  })
  return dbPromise
}

function draftKey(campaignId: string, entityId: string | null): string {
  return `${campaignId}:${entityId ?? 'new'}`
}

export async function saveDraft(
  campaignId: string,
  entityId: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, {
    key: draftKey(campaignId, entityId),
    campaignId,
    entityId,
    savedAt: new Date().toISOString(),
    data,
  } satisfies EntityDraft)
}

export async function loadDraft(
  campaignId: string,
  entityId: string | null,
): Promise<EntityDraft | undefined> {
  const db = await getDb()
  return db.get(STORE_NAME, draftKey(campaignId, entityId)) as Promise<EntityDraft | undefined>
}

export async function clearDraft(campaignId: string, entityId: string | null): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, draftKey(campaignId, entityId))
}
