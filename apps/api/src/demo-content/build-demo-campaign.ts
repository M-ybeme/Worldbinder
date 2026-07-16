import { apiEnvSchema, loadEnv } from '@worldbinder/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { campaigns, users } from '../database/schema';
import {
  ApiError,
  api,
  login,
  register,
  uploadBytes,
  verifyEmail,
} from './api-client';
import {
  BASE_URL,
  DEMO_CAMPAIGN_NAME,
  DEMO_EDITOR_EMAIL,
  DEMO_GM_EMAIL,
  DEMO_PASSWORD,
  DEMO_PLAYER_EMAIL,
} from './config';
import { DEMO_ATTACHMENTS } from './data/attachments';
import { DEMO_ENTITIES } from './data/entities';
import {
  DEMO_PLOT_THREAD_STATUS_CHANGES,
  RESTORE_BEAT_BAD_CONTENT,
  RESTORE_BEAT_ENTITY_SLUG,
  RESTORE_BEAT_ENTITY_TYPE,
  buildEntityEnrichments,
} from './data/enrichment';
import { DEMO_MAPS } from './data/maps';
import { DEMO_PLOT_THREADS } from './data/plot-threads';
import {
  BUILT_IN_TYPE_IDS,
  DEMO_CUSTOM_RELATIONSHIP_TYPES,
  DEMO_RELATIONSHIPS,
} from './data/relationships';
import { DEMO_SESSIONS } from './data/sessions';
import { DEMO_TIMELINE_EVENTS } from './data/timeline';
import { findEmailToken } from './mailpit';
import { mentionRef, ref, resolveMentions, resolveRefs } from './refs';

/**
 * Milestone 15 Phase 1 — demo-content build script, scaffolding stage.
 * Covers account registration/verification and campaign+membership setup
 * only; entity/relationship/session/etc. content is Phase 2+. Run via
 * `pnpm --filter @worldbinder/api seed:demo` against a running dev stack
 * (`pnpm infra:up` + `pnpm dev`) — real HTTP calls throughout, see
 * `api-client.ts`'s doc comment for why.
 *
 * Idempotent, but deliberately only re-creates the CAMPAIGN on each run,
 * not the demo accounts: `POST /auth/register` is rate-limited to 5/hour
 * per IP (`auth.constants.ts`'s `registerPerIp`), and Phase 2+ re-runs
 * this script many times while iterating on campaign content — reusing
 * already-verified accounts (login-first, register-as-fallback) avoids
 * burning that budget on every iteration. Found the hard way: the first
 * version of this script re-registered every run and hit the limit on
 * its third invocation.
 */

interface DemoAccount {
  email: string;
  displayName: string;
  token: string;
  userId: string;
}

async function cleanupPreviousCampaign(): Promise<void> {
  const env = loadEnv(apiEnvSchema);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  const [gmUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_GM_EMAIL));

  if (gmUser) {
    // Cascades away every campaign-scoped row (members, entities,
    // relationships, sessions, ...) — see schema.ts's campaignId FKs.
    // Demo user accounts themselves are kept, see file doc comment.
    await db.delete(campaigns).where(eq(campaigns.ownerUserId, gmUser.id));
  }

  await pool.end();
}

async function ensureAccount(
  email: string,
  displayName: string,
): Promise<DemoAccount> {
  try {
    const { token, userId } = await login(email, DEMO_PASSWORD);
    return { email, displayName, token, userId };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }

  await register(email, DEMO_PASSWORD, displayName);
  const token = await findEmailToken(email, 'Verify your Worldbinder account');
  await verifyEmail(token);
  const { token: accessToken, userId } = await login(email, DEMO_PASSWORD);

  return { email, displayName, token: accessToken, userId };
}

async function createEntities(
  campaignId: string,
  gmToken: string,
): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  for (const entity of DEMO_ENTITIES) {
    const body = resolveRefs(
      {
        entityType: entity.entityType,
        name: entity.name,
        summary: entity.summary,
        visibility: entity.visibility,
        tags: entity.tags,
        metadata: entity.metadata,
        publicContentJson: entity.publicContentJson,
        gmContentJson: entity.gmContentJson,
      },
      slugToId,
    );

    const created = await api.post<{ id: string }>(
      `/campaigns/${campaignId}/entities`,
      body,
      gmToken,
    );
    slugToId.set(entity.slug, created.id);
    process.stdout.write(
      `\r  ${slugToId.size}/${DEMO_ENTITIES.length} entities created`,
    );
  }
  process.stdout.write('\n');

  return slugToId;
}

async function createRelationships(
  campaignId: string,
  gmToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  const typeIds = new Map<string, string>(Object.entries(BUILT_IN_TYPE_IDS));

  for (const type of DEMO_CUSTOM_RELATIONSHIP_TYPES) {
    const created = await api.post<{ id: string }>(
      `/campaigns/${campaignId}/relationship-types`,
      {
        key: type.key,
        forwardLabel: type.forwardLabel,
        reverseLabel: type.reverseLabel,
      },
      gmToken,
    );
    typeIds.set(type.key, created.id);
  }

  let created = 0;
  for (const relationship of DEMO_RELATIONSHIPS) {
    const relationshipTypeId = typeIds.get(relationship.typeKey);
    if (!relationshipTypeId) {
      throw new Error(
        `Unknown relationship type key: "${relationship.typeKey}"`,
      );
    }
    const body = resolveRefs(
      {
        sourceEntityId: ref(relationship.source),
        targetEntityId: ref(relationship.target),
        relationshipTypeId,
        description: relationship.description,
        visibility: relationship.visibility,
      },
      slugToId,
    );
    await api.post(`/campaigns/${campaignId}/relationships`, body, gmToken);
    created += 1;
    process.stdout.write(
      `\r  ${created}/${DEMO_RELATIONSHIPS.length} relationships created`,
    );
  }
  process.stdout.write('\n');
}

async function createPlotThreads(
  campaignId: string,
  gmToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  let created = 0;
  for (const thread of DEMO_PLOT_THREADS) {
    const body = resolveRefs(
      {
        title: thread.title,
        summary: thread.summary,
        importance: thread.importance,
        visibility: thread.visibility,
        entityIds: thread.entitySlugs.map((slug) => ref(slug)),
        publicContentJson: thread.publicContentJson,
        gmContentJson: thread.gmContentJson,
      },
      slugToId,
    );
    const result = await api.post<{ id: string }>(
      `/campaigns/${campaignId}/plot-threads`,
      body,
      gmToken,
    );
    slugToId.set(thread.slug, result.id);
    created += 1;
    process.stdout.write(
      `\r  ${created}/${DEMO_PLOT_THREADS.length} plot threads created`,
    );
  }
  process.stdout.write('\n');
}

async function createSessions(
  campaignId: string,
  gmToken: string,
  participantMemberIds: string[],
  slugToId: Map<string, string>,
): Promise<void> {
  let created = 0;
  for (const session of DEMO_SESSIONS) {
    const createBody = resolveRefs(
      {
        title: session.title,
        worldStartDateJson: { schemaVersion: 1, ...session.worldStartDate },
        participantIds: participantMemberIds,
        featuredEntityIds: session.featuredEntitySlugs.map((slug) => ref(slug)),
        locationEntityIds: session.locationEntitySlugs.map((slug) => ref(slug)),
        plotThreadChanges: session.plotThreadChanges.map((change) => ({
          plotThreadId: ref(change.threadSlug),
          action: change.action,
        })),
        plannedContentJson: session.plannedContentJson,
      },
      slugToId,
    );
    const result = await api.post<{ id: string; updatedAt: string }>(
      `/campaigns/${campaignId}/sessions`,
      createBody,
      gmToken,
    );
    slugToId.set(session.slug, result.id);
    let updatedAt = result.updatedAt;

    if (session.reveal) {
      await api.post(
        `/campaigns/${campaignId}/sessions/${result.id}/reveals`,
        resolveRefs({ entityId: ref(session.reveal) }, slugToId),
        gmToken,
      );
    }

    if (session.complete) {
      const completed = await api.post<{ updatedAt: string }>(
        `/campaigns/${campaignId}/sessions/${result.id}/complete`,
        {
          recapContentJson: session.recapContentJson,
          worldEndDateJson: session.worldEndDate
            ? { schemaVersion: 1, ...session.worldEndDate }
            : undefined,
          updatedAt,
        },
        gmToken,
      );
      updatedAt = completed.updatedAt;
    }

    created += 1;
    process.stdout.write(
      `\r  ${created}/${DEMO_SESSIONS.length} sessions created`,
    );
  }
  process.stdout.write('\n');
}

async function createTimelineEvents(
  campaignId: string,
  gmToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  let created = 0;
  for (const event of DEMO_TIMELINE_EVENTS) {
    const body = resolveRefs(
      {
        title: event.title,
        summary: event.summary,
        visibility: event.visibility,
        startDateJson: event.date
          ? { schemaVersion: 1, ...event.date }
          : undefined,
        datePrecision: event.datePrecision,
        entityIds: event.entitySlugs?.map((slug) => ref(slug)),
        sessionIds: event.sessionSlugs?.map((slug) => ref(slug)),
        tags: event.tags,
        contentJson: event.contentJson,
      },
      slugToId,
    );
    await api.post(`/campaigns/${campaignId}/timeline`, body, gmToken);
    created += 1;
    process.stdout.write(
      `\r  ${created}/${DEMO_TIMELINE_EVENTS.length} timeline events created`,
    );
  }
  process.stdout.write('\n');
}

async function createMaps(
  campaignId: string,
  gmToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  for (const map of DEMO_MAPS) {
    const created = await api.post<{ id: string }>(
      `/campaigns/${campaignId}/maps`,
      { name: map.name, description: map.description },
      gmToken,
    );
    slugToId.set(map.slug, created.id);

    for (const layer of map.layers) {
      const createdLayer = await api.post<{ id: string }>(
        `/campaigns/${campaignId}/maps/${created.id}/layers`,
        {
          name: layer.name,
          displayOrder: layer.displayOrder,
          visibility: layer.visibility,
        },
        gmToken,
      );
      slugToId.set(layer.slug, createdLayer.id);
    }

    for (const pin of map.pins) {
      const body = resolveRefs(
        {
          layerId: pin.layerSlug ? ref(pin.layerSlug) : undefined,
          locationEntityId: pin.locationSlug
            ? ref(pin.locationSlug)
            : undefined,
          label: pin.label,
          xNormalized: pin.x,
          yNormalized: pin.y,
          visibility: pin.visibility,
        },
        slugToId,
      );
      await api.post(
        `/campaigns/${campaignId}/maps/${created.id}/pins`,
        body,
        gmToken,
      );
    }
  }
  console.log(
    `  ${DEMO_MAPS.length}/${DEMO_MAPS.length} maps (with layers and pins) created`,
  );
}

async function waitUntilReady(
  campaignId: string,
  attachmentId: string,
  gmToken: string,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const attachment = await api.get<{ status: string }>(
      `/campaigns/${campaignId}/attachments/${attachmentId}`,
      gmToken,
    );
    if (attachment.status === 'ready') return;
    if (attachment.status === 'rejected') {
      throw new Error(`Attachment ${attachmentId} was rejected by the worker`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Attachment ${attachmentId} never reached "ready" — is apps/worker running?`,
  );
}

async function createAttachments(
  campaignId: string,
  gmToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  let created = 0;
  for (const attachment of DEMO_ATTACHMENTS) {
    const presigned = await api.post<{
      attachmentId: string;
      uploadUrl: string;
    }>(
      `/campaigns/${campaignId}/attachments/presign`,
      {
        filename: attachment.filename,
        declaredMimeType: attachment.mimeType,
        sizeBytes: attachment.bytes.byteLength,
      },
      gmToken,
    );
    await uploadBytes(presigned.uploadUrl, attachment.bytes);
    await api.post(
      `/campaigns/${campaignId}/attachments/${presigned.attachmentId}/complete`,
      undefined,
      gmToken,
    );
    await waitUntilReady(campaignId, presigned.attachmentId, gmToken);

    const link = attachment.link;
    if (link.kind === 'map_image') {
      const mapId = slugToId.get(link.slug);
      if (!mapId)
        throw new Error(`Unresolved demo-content ref: "${link.slug}"`);
      await api.patch(
        `/campaigns/${campaignId}/maps/${mapId}`,
        { imageAttachmentId: presigned.attachmentId },
        gmToken,
      );
    } else if (link.kind === 'campaign_cover') {
      await api.patch(
        `/campaigns/${campaignId}`,
        { coverAttachmentId: presigned.attachmentId },
        gmToken,
      );
    } else {
      const resourceId = slugToId.get(link.slug);
      if (!resourceId)
        throw new Error(`Unresolved demo-content ref: "${link.slug}"`);
      await api.post(
        `/campaigns/${campaignId}/attachments/${presigned.attachmentId}/link`,
        { resourceType: link.kind, resourceId, caption: attachment.caption },
        gmToken,
      );
    }

    created += 1;
    process.stdout.write(
      `\r  ${created}/${DEMO_ATTACHMENTS.length} attachments created`,
    );
  }
  process.stdout.write('\n');
}

/**
 * Milestone 15 Phase 3 — run as the *editor* account, not the GM who
 * created everything in Phase 2. A different actor is what makes
 * `RevisionRecorderService` open a genuine second revision instead of
 * silently merging into the creation edit (its ~30-minute same-actor
 * merge window). Rewrites a curated subset of entities with real inline
 * `entityMention` wiki-link nodes.
 */
async function enrichEntities(
  campaignId: string,
  editorToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  const slugToName = new Map(DEMO_ENTITIES.map((e) => [e.slug, e.name]));
  const enrichments = buildEntityEnrichments(mentionRef);

  let updated = 0;
  for (const enrichment of enrichments) {
    const entityId = slugToId.get(enrichment.slug);
    if (!entityId) {
      throw new Error(`Unresolved demo-content ref: "${enrichment.slug}"`);
    }
    const current = await api.get<{
      updatedAt: string;
      metadata?: Record<string, unknown>;
    }>(`/campaigns/${campaignId}/entities/${entityId}`, editorToken);

    const publicContentJson = enrichment.publicContentJson
      ? resolveMentions(enrichment.publicContentJson, slugToId, slugToName)
      : undefined;
    const gmContentJson = enrichment.gmContentJson
      ? resolveMentions(enrichment.gmContentJson, slugToId, slugToName)
      : undefined;

    await api.patch(
      `/campaigns/${campaignId}/entities/${entityId}`,
      {
        entityType: enrichment.entityType,
        updatedAt: current.updatedAt,
        metadata: enrichment.metadataPatch
          ? { ...current.metadata, ...enrichment.metadataPatch }
          : undefined,
        publicContentJson,
        gmContentJson,
      },
      editorToken,
    );
    updated += 1;
    process.stdout.write(
      `\r  ${updated}/${enrichments.length} entities enriched`,
    );
  }
  process.stdout.write('\n');
}

async function escalatePlotThreads(
  campaignId: string,
  editorToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  let updated = 0;
  for (const change of DEMO_PLOT_THREAD_STATUS_CHANGES) {
    const threadId = slugToId.get(change.slug);
    if (!threadId) {
      throw new Error(`Unresolved demo-content ref: "${change.slug}"`);
    }
    const current = await api.get<{ updatedAt: string }>(
      `/campaigns/${campaignId}/plot-threads/${threadId}`,
      editorToken,
    );
    await api.patch(
      `/campaigns/${campaignId}/plot-threads/${threadId}`,
      { status: change.status, updatedAt: current.updatedAt },
      editorToken,
    );
    updated += 1;
    process.stdout.write(
      `\r  ${updated}/${DEMO_PLOT_THREAD_STATUS_CHANGES.length} plot threads escalated`,
    );
  }
  process.stdout.write('\n');
}

/**
 * The restore-beat: a real bad edit as the editor (overwriting Maren's
 * Phase-2 content), then a real restore back to her original GM-authored
 * revision. `RevisionsService.restore()` always forces a new revision
 * regardless of timing, so this produces a third, restore-labeled
 * revision — proving the restore path genuinely works on real data, not
 * just that the button exists.
 */
async function runRestoreBeat(
  campaignId: string,
  editorToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  const entityId = slugToId.get(RESTORE_BEAT_ENTITY_SLUG);
  if (!entityId) {
    throw new Error(
      `Unresolved demo-content ref: "${RESTORE_BEAT_ENTITY_SLUG}"`,
    );
  }

  const beforeBadEdit = await api.get<{ updatedAt: string }>(
    `/campaigns/${campaignId}/entities/${entityId}`,
    editorToken,
  );
  await api.patch(
    `/campaigns/${campaignId}/entities/${entityId}`,
    {
      entityType: RESTORE_BEAT_ENTITY_TYPE,
      updatedAt: beforeBadEdit.updatedAt,
      publicContentJson: RESTORE_BEAT_BAD_CONTENT,
    },
    editorToken,
  );
  console.log('  Bad edit applied to Old Maren.');

  interface RevisionSummary {
    id: string;
    revisionNumber: number;
  }
  const revisions = await api.get<RevisionSummary[]>(
    `/campaigns/${campaignId}/revisions/entity/${entityId}`,
    editorToken,
  );
  const original = revisions.reduce((min, r) =>
    r.revisionNumber < min.revisionNumber ? r : min,
  );

  await api.post(
    `/campaigns/${campaignId}/revisions/${original.id}/restore`,
    undefined,
    editorToken,
  );
  console.log(
    `  Restored Old Maren to revision #${original.revisionNumber} (of ${revisions.length} total).`,
  );
}

/**
 * Milestone 15 Phase 4 — real PASS/FAIL checks against the live campaign,
 * not just a description of what "should" work. Search examples (as GM)
 * prove the interconnection §28 asks the demo to demonstrate; the same
 * queries run as the player prove `gm_only` content is actually filtered,
 * not just marked — directly exercising the beta goal "find permission
 * edge cases." Throws if anything fails, so a broken demo build is loud,
 * not silently reported as done.
 */
async function verifyDemoCampaign(
  campaignId: string,
  gmToken: string,
  playerToken: string,
  slugToId: Map<string, string>,
): Promise<void> {
  let failures = 0;
  const check = (label: string, condition: boolean): void => {
    console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}`);
    if (!condition) failures += 1;
  };

  interface SearchResponse {
    results: { title: string }[];
  }
  const search = async (token: string, q: string): Promise<string[]> => {
    const res = await api.get<SearchResponse>(
      `/campaigns/${campaignId}/search?q=${encodeURIComponent(q)}&limit=20`,
      token,
    );
    return res.results.map((r) => r.title);
  };

  const gmDrowned = await search(gmToken, 'drowned');
  check(
    'GM search "drowned" surfaces The Drowned Codex',
    gmDrowned.includes('The Drowned Codex'),
  );
  check(
    'GM search "drowned" surfaces The Drowning',
    gmDrowned.includes('The Drowning'),
  );
  check(
    'GM search "drowned" surfaces The Drowned God\'s Return',
    gmDrowned.includes("The Drowned God's Return"),
  );

  const gmSeal = await search(gmToken, 'seal');
  check(
    'GM search "seal" surfaces The Ashgate Seal',
    gmSeal.includes('The Ashgate Seal'),
  );
  check(
    'GM search "seal" surfaces Recover the Ashgate Seal',
    gmSeal.includes('Recover the Ashgate Seal'),
  );

  // "vessic" is never revealed to players (unlike `the-hollow-beneath`,
  // which session 5's reveal deliberately exposes — a real fuzzy-search
  // false positive on "hollow" caught during Phase 4 verification: it also
  // matches the public "Hollis Grey" and "Kettle Underhollow" by
  // similarity, and correctly surfaces the now-revealed Hollow Beneath, so
  // it doesn't actually distinguish still-hidden content from visible
  // content the way this check needs).
  const gmVessic = await search(gmToken, 'vessic');
  check(
    'GM search "vessic" surfaces Prior Vessic',
    gmVessic.includes('Prior Vessic'),
  );
  const playerVessic = await search(playerToken, 'vessic');
  check(
    'Player search "vessic" surfaces nothing (never revealed, still gm_only)',
    playerVessic.length === 0,
  );

  const playerHollowBeneath = await search(playerToken, 'hollow beneath');
  check(
    'Player search "hollow beneath" surfaces it — session 5 revealed it to players',
    playerHollowBeneath.includes('The Hollow Beneath'),
  );

  const vessicId = slugToId.get('vessic');
  if (!vessicId) throw new Error('Unresolved demo-content ref: "vessic"');
  try {
    await api.get(`/campaigns/${campaignId}/entities/${vessicId}`, playerToken);
    check('Player direct-fetching a gm_only entity is rejected', false);
  } catch (error) {
    check(
      'Player direct-fetching a gm_only entity gets 404 (not confirming existence)',
      error instanceof ApiError && error.status === 404,
    );
  }

  const ostenId = slugToId.get('osten');
  if (!ostenId) throw new Error('Unresolved demo-content ref: "osten"');
  interface Backlink {
    sourceEntity: { name: string };
  }
  const ostenBacklinks = await api.get<Backlink[]>(
    `/campaigns/${campaignId}/entities/${ostenId}/backlinks`,
    gmToken,
  );
  check(
    'Osten has a real backlink from The Hollow Choir (wiki-link enrichment worked)',
    ostenBacklinks.some((b) => b.sourceEntity.name === 'The Hollow Choir'),
  );

  console.log('');
  if (failures > 0) {
    throw new Error(`${failures} verification check(s) failed`);
  }
  console.log('All verification checks passed.');
}

async function main(): Promise<void> {
  console.log(`Building demo campaign against ${BASE_URL}...`);
  console.log('Cleaning up any previous campaign...');
  await cleanupPreviousCampaign();

  console.log(
    'Ensuring demo accounts exist (login-first, register as fallback)...',
  );
  const gm = await ensureAccount(DEMO_GM_EMAIL, 'Ashgate GM');
  const editor = await ensureAccount(DEMO_EDITOR_EMAIL, 'Ashgate Co-Writer');
  const player = await ensureAccount(DEMO_PLAYER_EMAIL, 'Ashgate Player');

  console.log(`Creating campaign "${DEMO_CAMPAIGN_NAME}"...`);
  interface CampaignDetail {
    id: string;
    name: string;
    slug: string;
  }
  const campaign = await api.post<CampaignDetail>(
    '/campaigns',
    {
      name: DEMO_CAMPAIGN_NAME,
      description:
        "A low-fantasy political/horror campaign at the last free river-ford before a crumbling empire's border.",
      systemName: 'System-agnostic',
    },
    gm.token,
  );
  console.log(`Campaign created: ${campaign.id} (slug: ${campaign.slug})`);

  // `createCampaignSchema`/`updateCampaignSchema` have no `status` field at
  // all — `POST .../restore` is the only API path that ever sets
  // `status: 'active'` (campaigns.service.ts:227-241), even though nothing
  // requires the campaign to have been archived first. A demo campaign
  // with 5 played sessions showing as "draft" would be a visible, honest
  // inaccuracy — found during the Phase 4 browser walkthrough, not assumed.
  await api.post(`/campaigns/${campaign.id}/restore`, undefined, gm.token);

  console.log('Inviting editor and player members...');
  for (const [account, role] of [
    [editor, 'editor'],
    [player, 'player'],
  ] as const) {
    await api.post(
      `/campaigns/${campaign.id}/invitations`,
      { email: account.email, role },
      gm.token,
    );
    // Invitation links embed the token in the URL path
    // (/accept-invitation/<token>), not a `?token=` query string like
    // verify-email/reset-password links — needs the custom pattern.
    const token = await findEmailToken(
      account.email,
      'invited to',
      /accept-invitation\/([^"\s]+)/,
    );
    const result = await api.post<{ campaignId: string }>(
      `/invitations/${token}/accept`,
      undefined,
      account.token,
    );
    console.log(
      `  ${account.email} accepted as ${role} (campaign ${result.campaignId})`,
    );
  }

  console.log(`Creating ${DEMO_ENTITIES.length} entities...`);
  const slugToId = await createEntities(campaign.id, gm.token);

  console.log(
    `Creating ${DEMO_CUSTOM_RELATIONSHIP_TYPES.length} custom relationship types and ${DEMO_RELATIONSHIPS.length} relationships...`,
  );
  await createRelationships(campaign.id, gm.token, slugToId);

  console.log(`Creating ${DEMO_PLOT_THREADS.length} plot threads...`);
  await createPlotThreads(campaign.id, gm.token, slugToId);

  // Sessions' participantIds are campaignMembers.id (the membership row),
  // not users.id — SessionsService.syncParticipants validates against
  // campaign_members directly (sessions.service.ts:678-691). Fetch the
  // real member ids rather than assuming they match the user ids.
  interface MembershipSummary {
    id: string;
    email: string;
  }
  const members = await api.get<MembershipSummary[]>(
    `/campaigns/${campaign.id}/members`,
    gm.token,
  );
  const participantMemberIds = members
    .filter((m) => m.email === editor.email || m.email === player.email)
    .map((m) => m.id);

  console.log(`Creating ${DEMO_SESSIONS.length} sessions...`);
  await createSessions(campaign.id, gm.token, participantMemberIds, slugToId);

  console.log(`Creating ${DEMO_TIMELINE_EVENTS.length} timeline events...`);
  await createTimelineEvents(campaign.id, gm.token, slugToId);

  console.log(`Creating ${DEMO_MAPS.length} maps...`);
  await createMaps(campaign.id, gm.token, slugToId);

  console.log(
    `Creating ${DEMO_ATTACHMENTS.length} attachments (requires apps/worker running)...`,
  );
  await createAttachments(campaign.id, gm.token, slugToId);

  // The enrichment pass below has the editor write gmContentJson on several
  // entities — CampaignPolicyService.canViewGmContent (and the matching
  // write check, assertCanWriteGmContent) requires editorSecretAccess for
  // the `editor` role, which the plain invite in Phase 1 didn't grant.
  // Realistic in-fiction equivalent: the GM has trusted their co-writer
  // with secrets.
  const editorMemberId = members.find((m) => m.email === editor.email)?.id;
  if (!editorMemberId) throw new Error('Editor membership not found');
  await api.patch(
    `/campaigns/${campaign.id}/members/${editorMemberId}`,
    { role: 'editor', editorSecretAccess: true },
    gm.token,
  );

  console.log('Enriching entities with wiki-link mentions (as the editor)...');
  await enrichEntities(campaign.id, editor.token, slugToId);

  console.log('Escalating plot thread statuses (as the editor)...');
  await escalatePlotThreads(campaign.id, editor.token, slugToId);

  console.log('Running the restore beat on Old Maren (as the editor)...');
  await runRestoreBeat(campaign.id, editor.token, slugToId);

  console.log('\nRunning verification checks...');
  await verifyDemoCampaign(campaign.id, gm.token, player.token, slugToId);

  console.log('\nDemo campaign build complete.');
  console.log(`Campaign id: ${campaign.id}`);
  console.log(`GM: ${gm.email}`);
  console.log(`Editor: ${editor.email}`);
  console.log(`Player: ${player.email}`);
  console.log(`Entities created: ${DEMO_ENTITIES.length}`);
  console.log(`Relationships created: ${DEMO_RELATIONSHIPS.length}`);
  console.log(`Plot threads created: ${DEMO_PLOT_THREADS.length}`);
  console.log(`Sessions created: ${DEMO_SESSIONS.length}`);
  console.log(`Timeline events created: ${DEMO_TIMELINE_EVENTS.length}`);
  console.log(`Maps created: ${DEMO_MAPS.length}`);
  console.log(`Attachments created: ${DEMO_ATTACHMENTS.length}`);
}

main().catch((error: unknown) => {
  console.error('Demo content build failed:', error);
  process.exit(1);
});
