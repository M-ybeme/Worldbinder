import type { TiptapDoc } from '@worldbinder/contracts'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useNavigate } from 'react-router-dom'
import { EntityMention } from './entityMentionExtension'

const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export interface RichTextEditorProps {
  label: string
  content: TiptapDoc | null
  onChange?: (doc: TiptapDoc) => void
  editable?: boolean
  /** Enables the `[[` wiki-link mention node — omit to render plain rich
   * text with no entity-linking capability. */
  campaignId?: string
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
}: RichTextEditorProps) {
  const navigate = useNavigate()

  const editor = useEditor({
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

  return (
    <div className="wb-field">
      <span className="wb-field__label">{label}</span>
      {editable && <RichTextToolbar editor={editor} />}
      <div className="wb-richtext">
        <EditorContent editor={editor} />
      </div>
    </div>
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
