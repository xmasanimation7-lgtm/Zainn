import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const html = useMemo(() => {
    let parsed = content;
    
    // Escape HTML first
    parsed = parsed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Parse markdown (order matters!)
    // Headers
    parsed = parsed.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    parsed = parsed.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    parsed = parsed.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');
    
    // Bold
    parsed = parsed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Italic
    parsed = parsed.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
    
    // Bullet points
    parsed = parsed.replace(/^• (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
    parsed = parsed.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
    
    // Numbered lists
    parsed = parsed.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
    
    // Wrap consecutive list items
    parsed = parsed.replace(
      /(<li class="ml-4 list-disc">.+<\/li>\n?)+/g, 
      '<ul class="my-2 space-y-1">$&</ul>'
    );
    parsed = parsed.replace(
      /(<li class="ml-4 list-decimal">.+<\/li>\n?)+/g, 
      '<ol class="my-2 space-y-1">$&</ol>'
    );
    
    // Line breaks
    parsed = parsed.replace(/\n/g, '<br/>');
    
    return parsed;
  }, [content]);

  return (
    <div 
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
