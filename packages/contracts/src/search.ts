export type SearchResourceType = 'entity' | 'session' | 'plot_thread' | 'relationship'

/** Offsets are into `text` and mark spans to highlight — never embedded
 * markup, so the frontend renders via plain text nodes (no
 * `dangerouslySetInnerHTML` anywhere in this codebase). */
export interface SearchSnippet {
  text: string
  highlights: [number, number][]
}

export interface SearchResult {
  resourceType: SearchResourceType
  id: string
  title: string
  /** Precomputed display label for the type badge — e.g. an entity's
   * `entityType` ("Faction"), a session's number ("Session 4"), "Plot
   * Thread", or a relationship's forward label. */
  subtitle: string | null
  snippet: SearchSnippet | null
  /** Ranking tier per roadmap §14.3 (1 = exact name … 7 = relationship
   * description match) — lower is better. Exposed mainly for debugging/
   * tests; the frontend doesn't need to render it. */
  tier: number
  /** Relationships have no standalone page (roadmap Milestone 4 scope
   * note) — only set for `resourceType: 'relationship'`, pointing at the
   * source entity's detail page as the navigation target. */
  linkEntityId?: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
}
