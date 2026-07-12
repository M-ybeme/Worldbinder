import { mergeAttributes, Node } from '@tiptap/core'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { listEntities } from '../api/entitiesApi'

export interface EntityMentionOptions {
  campaignId: string
  /** Called when a mention is clicked in a read-only (`editable={false}`) editor. */
  onNavigate?: (entityId: string) => void
}

const SEARCH_DEBOUNCE_MS = 200

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
      }

      return { dom: span }
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
