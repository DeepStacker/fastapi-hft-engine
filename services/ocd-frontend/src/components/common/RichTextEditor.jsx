import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
    BoldIcon,
    ItalicIcon,
    ListBulletIcon,
    NumberedListIcon,
    CodeBracketIcon,
    LinkIcon
} from '@heroicons/react/24/outline';

const MenuBar = ({ editor }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 p-2 border-b border-gray-700/50 bg-gray-800/20 backdrop-blur-sm rounded-t-lg">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                title="Bold"
            >
                <BoldIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                title="Italic"
            >
                <ItalicIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-700 mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                title="Bullet List"
            >
                <ListBulletIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                title="Numbered List"
            >
                <NumberedListIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-700 mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-1.5 rounded transition-colors ${editor.isActive('codeBlock') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                title="Code Block"
            >
                <CodeBracketIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => {
                    const previousUrl = editor.getAttributes('link').href
                    const url = window.prompt('URL', previousUrl)
                    if (url === null) return
                    if (url === '') {
                        editor.chain().focus().extendMarkRange('link').unsetLink().run()
                        return
                    }
                    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
                }}
                className={`p-1.5 rounded transition-colors ${editor.isActive('link') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                title="Link"
            >
                <LinkIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const RichTextEditor = ({ content, onChange, placeholder = "Share your trade analysis...", minHeight = "150px" }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-400 hover:text-blue-300 underline cursor-pointer',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `prose prose-invert max-w-none focus:outline-none min-h-[${minHeight}] p-4 text-sm text-gray-200`,
            },
        },
    });

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/30 ring-1 ring-white/5 focus-within:ring-blue-500/50 transition-all">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} style={{ minHeight }} />
        </div>
    );
};

export default RichTextEditor;
