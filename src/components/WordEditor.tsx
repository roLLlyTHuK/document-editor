import React, { useRef, useEffect } from 'react';
import { Printer, Upload, FileDown } from 'lucide-react';
import _SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import mammoth from 'mammoth';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';
import { saveAs } from 'file-saver';

const SunEditor = (_SunEditor as typeof _SunEditor & { default?: typeof _SunEditor }).default || _SunEditor;

// -------------------------------------------------------------------
// HTML → docx
// -------------------------------------------------------------------
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const paragraphs: Paragraph[] = [];

  const nodeToRuns = (node: Node): TextRun[] => {
    if (node.nodeType === Node.TEXT_NODE) return [new TextRun(node.textContent || '')];
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const childRuns = Array.from(el.childNodes).flatMap(nodeToRuns);
    if (tag === 'br') return [new TextRun({ text: '', break: 1 })];
    if (tag === 'b' || tag === 'strong') return childRuns.map(r => new TextRun({ ...r, bold: true }));
    if (tag === 'i' || tag === 'em') return childRuns.map(r => new TextRun({ ...r, italics: true }));
    if (tag === 'u') return childRuns.map(r => new TextRun({ ...r, underline: {} }));
    return childRuns;
  };

  const processNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const headingMap: any = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 };
    if (headingMap[tag]) {
      paragraphs.push(new Paragraph({ heading: headingMap[tag], children: Array.from(el.childNodes).flatMap(nodeToRuns) }));
    } else if (tag === 'p' || tag === 'div') {
      paragraphs.push(new Paragraph({ children: Array.from(el.childNodes).flatMap(nodeToRuns) }));
    } else if (tag === 'li') {
      paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: Array.from(el.childNodes).flatMap(nodeToRuns) }));
    } else if (tag === 'ul' || tag === 'ol') {
      Array.from(el.children).forEach(processNode);
    } else {
      Array.from(el.childNodes).forEach(processNode);
    }
  };

  Array.from(div.childNodes).forEach(processNode);
  if (paragraphs.length === 0) paragraphs.push(new Paragraph({ children: [new TextRun(div.textContent || '')] }));
  return paragraphs;
}

// -------------------------------------------------------------------

interface Props {
  content: string; // either HTML or Base64 docx
  onChange: (val: string) => void;
  title: string;
}

export default function WordEditor({ content, onChange, title }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [htmlContent, setHtmlContent] = React.useState('');
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const lastProcessedContent = useRef<string | null>(null);

  // Effect to handle content loading.
  // We only run this when 'content' prop changes fundamentally (different from what we last set).
  useEffect(() => {
    const loadContent = async () => {
      if (!content) {
        setHtmlContent('<p>Start typing...</p>');
        lastProcessedContent.current = content;
        return;
      }
      
      // Prevent infinite loops if content is updated as HTML
      if (content === lastProcessedContent.current) return;

      const trimmed = content.trim();
      
      // Detection: If starts with <, it's HTML (legacy/temp)
      // If it's pure Base64, it shouldn't start with <
      if (trimmed.startsWith('<')) {
        setHtmlContent(content);
        lastProcessedContent.current = content;
        return;
      }

      // Try to treat as Base64 docx/doc
      try {
        if (/^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
          const binaryString = window.atob(trimmed);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          
          const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B; 

          if (isZip) {
            const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
            setHtmlContent(result.value);
            lastProcessedContent.current = content;
          } else {
            // Fallback for non-zip (might be plain text or legacy)
            setHtmlContent(content);
            lastProcessedContent.current = content;
          }
        } else {
          setHtmlContent(content);
          lastProcessedContent.current = content;
        }
      } catch (e) {
        setHtmlContent(content);
        lastProcessedContent.current = content;
      }
    };
    loadContent();
  }, [content]);

  // Set up global helper for EditorPage to grab the binary version
  useEffect(() => {
    (window as any).getWordBase64 = async () => {
      // Use ref to avoid stale closure if re-render hasn't happened yet
      const paragraphs = htmlToDocxParagraphs(contentRef.current);
      const doc = new Document({ 
        title: titleRef.current,
        sections: [{ children: paragraphs }] 
      });
      const blob = await Packer.toBlob(doc);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
    };
    return () => { delete (window as any).getWordBase64; };
  }, []);

  // ---- Import ----
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'docx') {
        const b64 = await fileToBase64(file);
        onChange(b64); // Parent gets Base64 immediately
      } else {
        const text = await file.text();
        setHtmlContent(ext === 'html' ? text : `<pre>${text}</pre>`);
      }
    } catch (err: any) {
      alert(`Ошибка при открытии файла: ${err.message}`);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
  };

  // ---- Export Local ----
  const handleSaveDocx = async () => {
    const paragraphs = htmlToDocxParagraphs(htmlContent);
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title || 'document'}.docx`);
  };

  // ---- Print ----
  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (pw) {
      pw.document.write(`<html><head><style>body{font-family:sans-serif;padding:20mm}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px}</style></head><body>${htmlContent}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
      pw.document.close();
      pw.focus();
    }
  };

  return (
    <div className="flex-col" style={{ width: '100%', alignItems: 'center' }}>
      <div className="topbar" style={{ width: '100%', justifyContent: 'flex-end', gap: '12px' }}>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".docx,.doc,.txt,.html" style={{ display: 'none' }} />
        <button className="btn" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Открыть .docx</button>
        <button className="btn btn-primary" onClick={handleSaveDocx}><FileDown size={16} /> Сохранить .docx</button>
        <button className="btn" onClick={handlePrint}><Printer size={16} /> Печать</button>
      </div>
      <div className="editor-workspace" style={{ padding: '16px 0' }}>
        <div className="document-page" ref={printRef} style={{ width: '210mm', minHeight: '297mm', background: 'transparent' }}>
          <SunEditor
            setContents={htmlContent}
            onChange={(val) => {
               setHtmlContent(val);
               contentRef.current = val; // SYNC UPDATE for save
               // We keep it as HTML in parent state while active
               onChange(val); 
            }}
            setOptions={{ 
               height: 'auto', 
               minHeight: '297mm', 
               buttonList: [['undo', 'redo'],['font', 'fontSize', 'formatBlock'],['paragraphStyle', 'blockquote'],['bold', 'underline', 'italic', 'strike'],['fontColor', 'hiliteColor'],['removeFormat'],['outdent', 'indent'],['align', 'list', 'lineHeight'],['table', 'link', 'image'],['fullScreen', 'codeView']] 
            }}
          />
        </div>
      </div>
    </div>
  );
}
