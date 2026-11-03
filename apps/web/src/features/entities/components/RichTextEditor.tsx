import type { TiptapDoc } from '@worldbinder/contracts'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { MenuButton, useKeyboardInset } from '@worldbinder/ui'
import { AtSign, Bold, ChevronDown, Heading2, Italic, List, MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import { EntityMention } from './entityMentionExtension'

// The shell's phone breakpoint (bottom tabs).
const PHONE_QUERY = '(max-width: 768px)'
// Room kept below the caret on phones, so it never ends up under the
// floating toolbar (44px buttons + padding) when the editor scrolls to it.
const PHONE_SCROLL_MARGIN = 72

const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export interface RichTextEditorProps {
  label: string
  content: TiptapDoc | null
  onChange?: (doc: TiptapDoc) => void
  editable?: boolean
  /** Enables the `[[` wiki-link mention node — omit to render plain rich
   * text with no entity-linking capability. */
  campaignId?: string
  /** 'article' renders read-only content as prose for reading (the entity
   * page): no field label and no textbox role, which describe an input,
   * not a document. Only meaningful with `editable={false}`. */
  presentation?: 'field' | 'article'
}

/**
 * Content is treated as the editor's *initial* value only — to load a
 * different document (e.g. restoring a draft) remount via a `key` change
 * rather than expecting a live prop update to push into TipTap.
 */
export function RichTextEditor({
  label,
  content,
  onChange,
  editable = true,
  campaignId,
  presentation = 'field',
}: RichTextEditorProps) {
  const asArticle = presentation === 'article' && !editable
  const navigate = useNavigate()
  const labelId = useId()
  const isPhone = useMediaQuery(PHONE_QUERY)

  const editor = useEditor({
    editorProps: {
      // The visible label is a <span>, not a <label htmlFor>, since
      // TipTap's contenteditable div isn't a real form control — this is
      // the ARIA equivalent, set as a real DOM attribute on the
      // ProseMirror-managed element via editorProps rather than a prop
      // EditorContent doesn't forward. role="textbox" is required too —
      // a plain <div>'s implicit role doesn't permit aria-labelledby at
      // all, an automated scan caught aria-labelledby alone as invalid.
      attributes: asArticle
        ? {}
        : { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': labelId },
      // Keeps the caret clear of the floating phone toolbar when ProseMirror
      // scrolls it into view (typing, moving the cursor, selecting).
      scrollMargin: { top: 16, bottom: PHONE_SCROLL_MARGIN, left: 0, right: 0 },
      scrollThreshold: { top: 16, bottom: PHONE_SCROLL_MARGIN, left: 0, right: 0 },
    },
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      ...(campaignId
        ? [
            EntityMention.configure({
              campaignId,
              onNavigate: (entityId) => navigate(`/app/campaign/${campaignId}/world/${entityId}`),
            }),
          ]
        : []),
    ],
    content: (content ?? EMPTY_DOC) as JSONContent,
    editable,
    onUpdate: ({ editor: updated }) => {
      onChange?.(updated.getJSON() as TiptapDoc)
    },
  })

  if (!editor) return null

  if (asArticle) {
    return (
      <div className="wb-richtext wb-richtext--article">
        <EditorContent editor={editor} />
      </div>
    )
  }

  if (editable && isPhone) {
    return <PhoneRichText editor={editor} label={label} labelId={labelId} />
  }

  return (
    <div className="wb-field">
      <span id={labelId} className="wb-field__label">
        {label}
      </span>
      {editable && <RichTextToolbar editor={editor} />}
      <div className="wb-richtext">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

/**
 * Phones: a compact toolbar (bold, italic, heading, list, entity link, and
 * a "More" menu for the rest). While this editor — or its toolbar — has
 * focus, the toolbar floats just above the on-screen keyboard (or the tab
 * bar when there's no keyboard), with a "Hide keyboard" button; an empty
 * placeholder keeps its place so nothing below jumps. The caret is kept
 * clear of it (scrollMargin), including when the keyboard resizes the
 * visible area. The editor itself is the same element either way.
 */
function PhoneRichText({ editor, label, labelId }: { editor: Editor; label: string; labelId: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const keyboardInset = useKeyboardInset(active)

  // ProseMirror scrolls the caret into view within the *layout* viewport,
  // which the on-screen keyboard doesn't shrink — so also keep it inside
  // the *visible* area, above the toolbar: as you type, move the cursor or
  // select, and whenever the keyboard opens or resizes.
  useEffect(() => {
    if (!active) return
    const keepCaretVisible = () => {
      if (!editor.isFocused) return
      const caret = editor.view.coordsAtPos(editor.state.selection.head)
      const viewport = window.visualViewport
      const visibleTop = (viewport?.offsetTop ?? 0) + 8
      const visibleBottom =
        (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - PHONE_SCROLL_MARGIN
      if (caret.bottom > visibleBottom) window.scrollBy(0, caret.bottom - visibleBottom)
      else if (caret.top < visibleTop) window.scrollBy(0, caret.top - visibleTop)
    }
    keepCaretVisible()
    editor.on('selectionUpdate', keepCaretVisible)
    editor.on('update', keepCaretVisible)
    return () => {
      editor.off('selectionUpdate', keepCaretVisible)
      editor.off('update', keepCaretVisible)
    }
  }, [active, keyboardInset, editor])

  const onFocus = () => setActive(true)
  const onBlur = (event: FocusEvent) => {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setActive(false)
  }

  return (
    <div className="wb-field" ref={rootRef} onFocus={onFocus} onBlur={onBlur}>
      <span id={labelId} className="wb-field__label">
        {label}
      </span>
      <div className="wb-richtext-toolbar-slot">
        <div
          className={['wb-richtext-toolbar', 'wb-richtext-toolbar--compact', active ? 'wb-richtext-toolbar--floating' : '']
            .filter(Boolean)
            .join(' ')}
          style={active && keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
          role="toolbar"
          aria-label={`${label} formatting`}
          // Pressing any control here (More included) must not take focus
          // from the editor: Safari doesn't focus buttons on click, so the
          // editor would blur, the keyboard close, and the toolbar drop out
          // from under the finger mid-tap.
          onMouseDown={(event) => event.preventDefault()}
        >
          <CompactButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={18} aria-hidden="true" />
          </CompactButton>
          <CompactButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={18} aria-hidden="true" />
          </CompactButton>
          <CompactButton
            label="Heading"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={18} aria-hidden="true" />
          </CompactButton>
          <CompactButton
            label="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={18} aria-hidden="true" />
          </CompactButton>
          {editor.extensionManager.extensions.some((ext) => ext.name === 'entityMention') && (
            <CompactButton label="Link entity" onClick={() => editor.chain().focus().insertContent('[[').run()}>
              <AtSign size={18} aria-hidden="true" />
            </CompactButton>
          )}
          <MenuButton
            label={<MoreHorizontal size={18} aria-hidden="true" />}
            ariaLabel="More formatting"
            menuLabel="More formatting"
            buttonClassName="wb-richtext-toolbar__button"
            placement="above"
            items={[
              { label: 'Heading 3', onSelect: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
              { label: 'Numbered list', onSelect: () => editor.chain().focus().toggleOrderedList().run() },
              { label: 'Quote', onSelect: () => editor.chain().focus().toggleBlockquote().run() },
              { label: 'Strikethrough', onSelect: () => editor.chain().focus().toggleStrike().run() },
              { label: 'Code block', onSelect: () => editor.chain().focus().toggleCodeBlock().run() },
              {
                label: 'Link',
                onSelect: () => {
                  const url = window.prompt('Link URL')
                  if (url) editor.chain().focus().setLink({ href: url }).run()
                  else editor.commands.focus()
                },
              },
              {
                label: 'Table',
                onSelect: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
              },
              { label: 'Undo', onSelect: () => editor.chain().focus().undo().run() },
              { label: 'Redo', onSelect: () => editor.chain().focus().redo().run() },
            ]}
          />
          {active && (
            <CompactButton label="Hide keyboard" onClick={() => editor.commands.blur()}>
              <ChevronDown size={18} aria-hidden="true" />
            </CompactButton>
          )}
        </div>
      </div>
      <div className="wb-richtext">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function CompactButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="wb-richtext-toolbar__button"
      aria-label={label}
      aria-pressed={active ?? undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

interface ToolbarButtonProps {
  label: string
  active?: boolean
  onClick: () => void
}

function ToolbarButton({ label, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="wb-richtext-toolbar__button"
      aria-label={label}
      aria-pressed={active ?? false}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function RichTextToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="wb-richtext-toolbar" role="toolbar" aria-label="Formatting">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton
        label="Link"
        active={editor.isActive('link')}
        onClick={() => {
          const url = window.prompt('Link URL')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
      />
      {editor.extensionManager.extensions.some((ext) => ext.name === 'entityMention') && (
        <ToolbarButton
          label="Link entity"
          onClick={() => editor.chain().focus().insertContent('[[').run()}
        />
      )}
      <ToolbarButton
        label="Table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} />
    </div>
  )
}
