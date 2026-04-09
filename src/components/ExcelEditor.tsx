import React, { useRef } from 'react';
import { Download, Printer, Upload } from 'lucide-react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';

export default function ExcelEditor({ content, onChange, title }: { content: string, onChange: (val: string) => void, title: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  let initialData = [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name !== undefined) {
        initialData = parsed;
    } else if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
        const grid = parsed.map((row: any[]) => row.map((cell: any) => (cell ? { v: cell, m: String(cell) } : null)));
        initialData = [{ name: 'Sheet1', data: grid }];
    } else {
        throw new Error();
    }
  } catch {
    initialData = [{ name: 'Sheet1', celldata: [] }];
  }

  const handleOnChange = (data: any) => {
    onChange(JSON.stringify(data));
  };

  const handlePrint = () => {
    // FortuneSheet doesn't support built-in browser print natively since it's canvas/DOM hybrid. 
    alert("К сожалению, печать из полноценного интерфейса Fortune Sheet пока не поддерживается в браузере. Вы можете экспортировать файл.");
  };

  const handleSaveLocal = () => {
    // Quick JSON export. In real apps, you'd use a library like exceljs to convert JSON back to .xlsx
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'spreadsheet'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only basic JSON import supported here since Fortune needs its own format or luckyexcel for xsxl
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if(typeof ev.target?.result === 'string') {
           const parsed = JSON.parse(ev.target.result);
           onChange(JSON.stringify(parsed));
           alert("Успешно загружено! Обновите страницу (или сохраните документ) чтобы увидеть изменения.");
        }
      } catch (err) {
        alert("Ошибка формата файла: используйте .json формат от Fortune Sheet");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-col" style={{ width: '100%', alignItems: 'center' }}>
      <div className="topbar" style={{ width: '100%', justifyContent: 'flex-end', gap: '12px' }}>
         <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" style={{ display: 'none' }} />
         <button className="btn" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import JSON</button>
         <button className="btn" onClick={handleSaveLocal}><Download size={16} /> Export JSON</button>
         <button className="btn" onClick={handlePrint}><Printer size={16} /> Print</button>
      </div>
      <div className="editor-workspace" style={{ padding: 0 }}>
         {/* Fortune-sheet needs a fixed height container to work optimally */}
         <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
            <Workbook data={initialData} onChange={handleOnChange} />
         </div>
      </div>
    </div>
  );
}
