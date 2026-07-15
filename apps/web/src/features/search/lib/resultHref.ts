import type { SearchResult } from '@worldbinder/contracts'

/** Relationships have no standalone page (roadmap Milestone 4 scope note)
 * — they link to their source entity's detail page instead. */
export function resultHref(campaignId: string, result: SearchResult): string {
  switch (result.resourceType) {
    case 'entity':
      return `/app/campaign/${campaignId}/world/${result.id}`
    case 'session':
      return `/app/campaign/${campaignId}/sessions/${result.id}`
    case 'plot_thread':
      return `/app/campaign/${campaignId}/threads/${result.id}`
    case 'relationship':
      return `/app/campaign/${campaignId}/world/${result.linkEntityId}`
    case 'timeline_event':
      return `/app/campaign/${campaignId}/world/timeline/${result.id}`
  }
}
