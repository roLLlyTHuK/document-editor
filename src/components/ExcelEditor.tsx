import React, { useRef, useEffect } from 'react';
import { Upload, FileDown } from 'lucide-react';
import { Workbook as FortuneWorkbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { type SheetData, parseExcelContent, fortuneToWorkbook, excelToBase64 } from '../lib/excelUtils';

// ---------------------------------------------------------------

interface Props {
  content: string;
  onChange: (val: string) => void;
  title: string;
}

export default function ExcelEditor({ content, onChange, title }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const lastProcessedContent = useRef<string | null>(null);
  const [fortuneData, setFortuneData] = React.useState<SheetData[]>([]);

  // Effect to handle content loading/parsing
  useEffect(() => {
    if (content === lastProcessedContent.current) return;
    
    const data = parseExcelContent(content);
    setFortuneData(data);
    lastProcessedContent.current = content;
  }, [content]);

  // Global helper for cloud save
  useEffect(() => {
    (window as any).getExcelBase64 = async () => {
      // Use the latest content from ref
      return excelToBase64(contentRef.current);
    };
    return () => { delete (window as any).getExcelBase64; };
  }, []);

  // FortuneSheet onChange gives full sheets array
  const handleFortuneChange = (data: SheetData[]) => {
    const json = JSON.stringify(data);
    lastProcessedContent.current = json; // Prevent re-parsing what we just emitted
    contentRef.current = json; // CRITICAL: Update ref synchronously to capture latest state for save
    onChange(json);
  };

  // ---- Import .xlsx / .xls ----
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const b64 = await fileToBase64(file);
      onChange(b64); // Parent gets Base64 immediately
    } catch (err) {
      console.error('Import error:', err);
      alert('Ошибка при открытии файла. Поддерживаются .xlsx, .xls, .csv');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ---- Export locally ----
  const handleSaveLocal = () => {
    try {
      const sheets = parseExcelContent(content);
      const wb = fortuneToWorkbook(sheets);
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${title || 'spreadsheet'}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Ошибка при экспорте файла.');
    }
  };

  return (
    <div className="flex-col" style={{ width: '100%', alignItems: 'center' }}>
      <div className="topbar" style={{ width: '100%', justifyContent: 'flex-end', gap: '12px' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx,.xls,.csv,.ods"
          style={{ display: 'none' }}
        />
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} /> Открыть файл (.xlsx, .xls)
        </button>
        <button className="btn btn-primary" onClick={handleSaveLocal}>
          <FileDown size={16} /> Сохранить .xlsx
        </button>
      </div>

      <div className="editor-workspace" style={{ padding: 0 }}>
        <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
          {fortuneData.length > 0 && (
            <FortuneWorkbook
              data={fortuneData}
              onChange={handleFortuneChange as (data: unknown[]) => void}
            />
          )}
        </div>
      </div>
    </div>
  );
}
