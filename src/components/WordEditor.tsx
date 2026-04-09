import React, { useRef } from 'react';
import { Download, Printer, Upload } from 'lucide-react';
import _SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';

const SunEditor = (_SunEditor as any).default ? (_SunEditor as any).default : _SunEditor;

export default function WordEditor({ content, onChange, title }: { content: string, onChange: (val: string) => void, title: string }) {
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && printRef.current) {
      printWindow.document.write('<html><head><title>Print Document</title>');
      printWindow.document.write('<style>body { font-family: sans-serif; padding: 20mm; } p { margin-bottom: 1em; } h1,h2,h3 { margin-bottom: 0.5em; } table {border-collapse: collapse;} td,th {border: 1px solid #ccc; padding: 4px;}</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(content || '');
      printWindow.document.write('<script>setTimeout(() => window.print(), 500);</script></body></html>');
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const handleSaveLocal = () => {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
         onChange(ev.target.result);
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-col" style={{ width: '100%', alignItems: 'center' }}>
      <div className="topbar" style={{ width: '100%', justifyContent: 'flex-end', gap: '12px' }}>
         <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.html,.md" style={{ display: 'none' }} />
         <button className="btn" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import File</button>
         <button className="btn" onClick={handleSaveLocal}><Download size={16} /> Save As HTML</button>
         <button className="btn" onClick={handlePrint}><Printer size={16} /> Legacy Print</button>
      </div>
      
      <div className="editor-workspace" style={{ padding: '0', paddingTop: '16px' }}>
         {/* SunEditor handles its own border and UI layout beautifully */}
         <div className="document-page" ref={printRef} style={{ width: '210mm', minHeight: '297mm', padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <SunEditor 
              setContents={content}
              onChange={onChange}
              setOptions={{
                height: 'auto',
                minHeight: '297mm',
                buttonList: [
                    ['undo', 'redo'],
                    ['font', 'fontSize', 'formatBlock'],
                    ['paragraphStyle', 'blockquote'],
                    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                    ['fontColor', 'hiliteColor', 'textStyle'],
                    ['removeFormat'],
                    ['outdent', 'indent'],
                    ['align', 'horizontalRule', 'list', 'lineHeight'],
                    ['table', 'link', 'image', 'video', 'audio'],
                    ['fullScreen', 'showBlocks', 'codeView'],
                    ['preview', 'print'],
                ]
              }}
            />
         </div>
      </div>
    </div>
  );
}
