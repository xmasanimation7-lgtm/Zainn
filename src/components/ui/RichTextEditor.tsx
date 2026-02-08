import { useRef, useCallback } from "react";
import { Button } from "./button";
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function RichTextEditor({ value, onChange, placeholder, rows = 6 }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = useCallback((prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let newText: string;
    let newCursorPos: number;
    
    if (suffix) {
      // Wrap selected text
      newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else {
      // Insert prefix at cursor or start of line
      if (selectedText) {
        // If text is selected, add prefix to each line
        const lines = selectedText.split('\n').map(line => prefix + line);
        newText = value.substring(0, start) + lines.join('\n') + value.substring(end);
      } else {
        newText = value.substring(0, start) + prefix + value.substring(end);
      }
      newCursorPos = start + prefix.length;
    }

    onChange(newText);

    // Restore focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  const formatActions = [
    { icon: Bold, action: () => insertFormatting("**", "**"), title: "Bold (Ctrl+B)" },
    { icon: Italic, action: () => insertFormatting("*", "*"), title: "Italic (Ctrl+I)" },
    { icon: Heading1, action: () => insertFormatting("# "), title: "Heading 1" },
    { icon: Heading2, action: () => insertFormatting("## "), title: "Heading 2" },
    { icon: Heading3, action: () => insertFormatting("### "), title: "Heading 3" },
    { icon: List, action: () => insertFormatting("• "), title: "Bullet List" },
    { icon: ListOrdered, action: () => insertFormatting("1. "), title: "Numbered List" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        insertFormatting("**", "**");
      } else if (e.key === 'i') {
        e.preventDefault();
        insertFormatting("*", "*");
      }
    }
  };

  return (
    <div className="rounded-lg border border-input bg-background overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
        {formatActions.map(({ icon: Icon, action, title }, index) => (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="sm"
            onClick={action}
            title={title}
            className="h-8 w-8 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      
      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none resize-none"
      />
    </div>
  );
}
