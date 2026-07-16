/**
 * Milestone 15 Phase 2 — entity metadata (`currentLocationEntityId`,
 * `leaderEntityId`, etc.) and cross-entity fields elsewhere (relationship
 * source/target, session participant ids, ...) all reference other demo
 * entities, but real UUIDs don't exist until each entity is actually
 * created. Data files write `ref('some-slug')` instead of a raw id;
 * `resolveRefs` walks a payload right before it's sent and swaps every
 * marker for the real id from the slug->id map built up as entities are
 * created — keeps the content data declarative and creation-order-only
 * dependent on which slugs exist yet, not on knowing ids in advance.
 */

const REF_MARKER = '__demoRef' as const;

export interface Ref {
  readonly [REF_MARKER]: string;
}

export function ref(slug: string): Ref {
  return { [REF_MARKER]: slug };
}

function isRef(value: unknown): value is Ref {
  return (
    typeof value === 'object' &&
    value !== null &&
    REF_MARKER in value &&
    typeof (value as Record<string, unknown>)[REF_MARKER] === 'string'
  );
}

export function resolveRefs<T>(
  value: T,
  slugToId: ReadonlyMap<string, string>,
): T {
  if (isRef(value)) {
    const id = slugToId.get(value[REF_MARKER]);
    if (!id) {
      throw new Error(
        `Unresolved demo-content ref: "${value[REF_MARKER]}" — is it created yet?`,
      );
    }
    return id as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      resolveRefs(item, slugToId),
    ) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveRefs(val, slugToId);
    }
    return result as T;
  }
  return value;
}

/**
 * Milestone 15 Phase 3 — a wiki-link mention inside TipTap content needs a
 * real `{ type: 'entityMention', attrs: { entityId, label } }` node (see
 * `WikiLinksService.extractMentions`'s doc comment), not just a resolved
 * id — `ref()`/`resolveRefs` above only swap a slug for an id, they don't
 * know how to build a whole node. `mentionRef(slug)` marks a spot in
 * enrichment content data; `resolveMentions` walks a doc right before
 * sending it and turns each marker into a real mention node, looking the
 * display label up from the same slug->name map entity creation built.
 */
const MENTION_MARKER = '__demoMention' as const;

export interface MentionRef {
  readonly [MENTION_MARKER]: string;
}

export function mentionRef(slug: string): MentionRef {
  return { [MENTION_MARKER]: slug };
}

function isMentionRef(value: unknown): value is MentionRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    MENTION_MARKER in value &&
    typeof (value as Record<string, unknown>)[MENTION_MARKER] === 'string'
  );
}

export function resolveMentions<T>(
  value: T,
  slugToId: ReadonlyMap<string, string>,
  slugToName: ReadonlyMap<string, string>,
): T {
  if (isMentionRef(value)) {
    const slug = value[MENTION_MARKER];
    const entityId = slugToId.get(slug);
    if (!entityId) {
      throw new Error(
        `Unresolved demo-content mention ref: "${slug}" — is it created yet?`,
      );
    }
    const label = slugToName.get(slug) ?? slug;
    return {
      type: 'entityMention',
      attrs: { entityId, label },
    } as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      resolveMentions(item, slugToId, slugToName),
    ) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveMentions(val, slugToId, slugToName);
    }
    return result as T;
  }
  return value;
}
