import type { EntityType } from '@worldbinder/contracts'
import { mergeAttributes, Node } from '@tiptap/core'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { getEntity, listEntities } from '../api/entitiesApi'
import { ENTITY_TYPE_LABELS } from '../lib/entityTypeIcons'
import '../entities.css'

export interface EntityMentionOptions {
  campaignId: string
  /** Called when a mention is clicked in a read-only (`editable={false}`) editor. */
  onNavigate?: (entityId: string) => void
}

const SEARCH_DEBOUNCE_MS = 200
const HOVER_PREVIEW_DEBOUNCE_MS = 300
const HOVER_TOOLTIP_ID = 'wb-entity-mention-tooltip'

/** Module-level singleton, shared by every mention NodeView in the
 * document — only one hover preview is ever shown at a time, so one
 * lazily-created DOM node (and one in-flight-request counter) avoids
 * allocating tooltip machinery per mention, of which a document can have
 * many. Mirrors this file's own `[[` autocomplete popup, which is the
 * same "one shared floating element, positioned per-trigger" shape. */
let tooltipEl: HTMLDivElement | null = null
let hoverDebounceHandle: ReturnType<typeof setTimeout> | undefined
let hoverRequestId = 0

function hideEntityPreview(): void {
  if (hoverDebounceHandle) clearTimeout(hoverDebounceHandle)
  hoverRequestId += 1
  tooltipEl?.remove()
  tooltipEl = null
}

function showEntityPreview(
  anchor: HTMLElement,
  entity: { name: string; entityType: EntityType; summary: string | null },
): void {
  tooltipEl?.remove()
  const el = document.createElement('div')
  el.id = HOVER_TOOLTIP_ID
  el.className = 'wb-entity-mention-tooltip'
  el.setAttribute('role', 'tooltip')

  const name = document.createElement('div')
  name.className = 'wb-entity-mention-tooltip__name'
  name.textContent = entity.name
  el.appendChild(name)

  const type = document.createElement('div')
  type.className = 'wb-entity-mention-tooltip__type'
  type.textContent = ENTITY_TYPE_LABELS[entity.entityType]
  el.appendChild(type)

  if (entity.summary) {
    const summary = document.createElement('div')
    summary.className = 'wb-entity-mention-tooltip__summary'
    summary.textContent = entity.summary
    el.appendChild(summary)
  }

  document.body.appendChild(el)
  const rect = anchor.getBoundingClientRect()
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.bottom + 4}px`
  tooltipEl = el
  anchor.setAttribute('aria-describedby', HOVER_TOOLTIP_ID)
}

/**
 * `[[` wiki-link autocomplete: typing `[[` opens an entity search popup;
 * selecting a result inserts an atomic `entityMention` node storing the
 * target entity's id, so renames never break the reference (extraction
 * happens server-side in `WikiLinksService`, keyed on this node shape).
 */
export const EntityMention = Node.create<EntityMentionOptions>({
  name: 'entityMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { campaignId: '', onNavigate: undefined }
  },

  addAttributes() {
    return {
      entityId: { default: null, parseHTML: (el) => el.getAttribute('data-entity-id') },
      label: { default: '', parseHTML: (el) => el.getAttribute('data-label') },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="entity-mention"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'entity-mention',
        'data-entity-id': node.attrs.entityId as string,
        'data-label': node.attrs.label as string,
        class: 'wb-entity-mention',
        role: 'link',
        tabindex: 0,
      }),
      node.attrs.label as string,
    ]
  },

  addNodeView() {
    return ({ node, editor }) => {
      const span = document.createElement('span')
      span.className = 'wb-entity-mention'
      span.textContent = node.attrs.label as string
      span.dataset.entityId = node.attrs.entityId as string
      span.setAttribute('role', 'link')
      span.tabIndex = 0

      if (!editor.isEditable) {
        span.addEventListener('click', (event) => {
          event.preventDefault()
          this.options.onNavigate?.(node.attrs.entityId as string)
        })

        const entityId = node.attrs.entityId as string
        const campaignId = this.options.campaignId

        const scheduleShow = () => {
          if (hoverDebounceHandle) clearTimeout(hoverDebounceHandle)
          const thisRequest = ++hoverRequestId
          hoverDebounceHandle = setTimeout(() => {
            void getEntity(campaignId, entityId)
              .then((entity) => {
                // Hover moved on, or the tooltip was already dismissed,
                // before this request resolved.
                if (thisRequest !== hoverRequestId) return
                showEntityPreview(span, {
                  name: entity.name,
                  entityType: entity.entityType,
                  summary: entity.summary,
                })
              })
              .catch(() => {
                // 404 (not visible to this viewer, same policy check
                // `getById` already enforces) or a transient error —
                // suppress the preview entirely rather than showing a
                // partial/misleading card. Filtered by the query, not
                // rendered then hidden.
              })
          }, HOVER_PREVIEW_DEBOUNCE_MS)
        }

        const cancelShow = () => {
          hideEntityPreview()
          span.removeAttribute('aria-describedby')
        }

        span.addEventListener('mouseenter', scheduleShow)
        span.addEventListener('mouseleave', cancelShow)
        span.addEventListener('focus', scheduleShow)
        span.addEventListener('blur', cancelShow)
      }

      return {
        dom: span,
        destroy: () => {
          if (span.getAttribute('aria-describedby') === HOVER_TOOLTIP_ID) hideEntityPreview()
        },
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '[[',
        // Entity names routinely contain spaces ("Westvale Village"), so
        // the query must be allowed to span them — otherwise the popup
        // silently closes the moment the user types a space.
        allowSpaces: true,
        items: () => [],
        command: ({ editor, range, props }) => {
          const item = props as { id: string; label: string }
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'entityMention', attrs: { entityId: item.id, label: item.label } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: () => {
          let popup: HTMLDivElement | null = null
          let activeIndex = 0
          let results: { id: string; label: string; entityType: string }[] = []
          let debounceHandle: ReturnType<typeof setTimeout> | undefined
          let requestId = 0
          let latestQuery = ''
          let latestCommand: SuggestionProps['command'] | null = null

          const campaignId = this.options.campaignId

          const closePopup = () => {
            popup?.remove()
            popup = null
          }

          const selectResult = (result: { id: string; label: string }) => {
            latestCommand?.({ id: result.id, label: result.label })
          }

          const renderList = () => {
            if (!popup) return
            popup.innerHTML = ''

            if (results.length === 0) {
              const empty = document.createElement('div')
              empty.className = 'wb-combobox__status'
              empty.textContent = latestQuery.length > 0 ? 'No matching entities' : 'Type to search'
              popup.appendChild(empty)
              return
            }

            results.forEach((result, index) => {
              const option = document.createElement('div')
              option.className =
                'wb-combobox__option' +
                (index === activeIndex ? ' wb-combobox__option--active' : '')
              option.textContent = result.label
              const meta = document.createElement('span')
              meta.className = 'wb-combobox__meta'
              meta.textContent = result.entityType
              option.appendChild(meta)
              option.addEventListener('mousedown', (event) => {
                event.preventDefault()
                selectResult(result)
              })
              popup?.appendChild(option)
            })
          }

          const search = (query: string) => {
            if (debounceHandle) clearTimeout(debounceHandle)
            const thisRequest = ++requestId
            const trimmed = query.trim()

            if (trimmed.length === 0) {
              results = []
              renderList()
              return
            }

            debounceHandle = setTimeout(() => {
              void listEntities(campaignId, { search: trimmed })
                .then((entities) => {
                  if (thisRequest !== requestId) return
                  results = entities.map((e) => ({
                    id: e.id,
                    label: e.name,
                    entityType: e.entityType,
                  }))
                  activeIndex = 0
                  renderList()
                })
                .catch(() => {
                  if (thisRequest !== requestId) return
                  results = []
                  renderList()
                })
            }, SEARCH_DEBOUNCE_MS)
          }

          const positionPopup = (props: SuggestionProps) => {
            if (!popup) return
            const rect = props.clientRect?.()
            if (!rect) return
            popup.style.position = 'fixed'
            popup.style.left = `${rect.left}px`
            popup.style.top = `${rect.bottom + 4}px`
          }

          return {
            onStart: (props: SuggestionProps) => {
              popup = document.createElement('div')
              popup.className = 'wb-combobox__listbox wb-entity-mention-popup'
              document.body.appendChild(popup)
              positionPopup(props)
              results = []
              activeIndex = 0
              latestQuery = props.query
              latestCommand = props.command
              search(props.query)
            },
            onUpdate: (props: SuggestionProps) => {
              positionPopup(props)
              latestQuery = props.query
              latestCommand = props.command
              search(props.query)
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (!popup || results.length === 0) {
                if (props.event.key === 'Escape') {
                  closePopup()
                  return true
                }
                return false
              }
              if (props.event.key === 'ArrowDown') {
                activeIndex = (activeIndex + 1) % results.length
                renderList()
                return true
              }
              if (props.event.key === 'ArrowUp') {
                activeIndex = (activeIndex - 1 + results.length) % results.length
                renderList()
                return true
              }
              if (props.event.key === 'Enter') {
                const item = results[activeIndex]
                if (item) selectResult(item)
                return true
              }
              if (props.event.key === 'Escape') {
                closePopup()
                return true
              }
              return false
            },
            onExit: () => {
              if (debounceHandle) clearTimeout(debounceHandle)
              closePopup()
            },
          }
        },
      }),
    ]
  },
})
