import * as XLSX from 'xlsx';

export interface CellData { 
  r: number; 
  c: number; 
  v: { 
    v: string | number | boolean | undefined; 
    m: string;
    ct?: any;
    [key: string]: any;
  } | null 
}
export interface SheetData { 
  name: string; 
  celldata?: CellData[];
  data?: any[][];
}

// ---------------------------------------------------------------
// SheetJS Workbook → FortuneSheet JSON
// ---------------------------------------------------------------
export function workbookToFortune(wb: XLSX.WorkBook): SheetData[] {
  const sheets: SheetData[] = [];

  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return;
    const celldata: CellData[] = [];
    
    const ref = ws['!ref'];
    if (!ref) {
      sheets.push({ name, celldata: [] });
      return;
    }

    const range = XLSX.utils.decode_range(ref);
    const data: any[][] = [];
    
    // Initialize full grid for FortuneSheet
    for (let r = 0; r <= range.e.r; r++) {
      data[r] = [];
      for (let c = 0; c <= range.e.c; c++) {
        data[r][c] = null;
      }
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && (cell.v !== undefined || cell.f)) {
          const fortuneCell = { 
            v: cell.v as string | number | boolean, 
            m: String(cell.w || cell.v || ''),
            ct: { fa: cell.z || 'General', t: cell.t || 'n' },
            f: cell.f ? `=${cell.f}` : undefined
          };
          
          celldata.push({ r, c, v: fortuneCell });
          data[r][c] = fortuneCell;
        }
      }
    }
    sheets.push({ name, celldata, data });
  });

  return sheets.length > 0 ? sheets : [{ name: 'Sheet1', celldata: [], data: [[]] }];
}

// ---------------------------------------------------------------
// FortuneSheet JSON → SheetJS Workbook
// ---------------------------------------------------------------
export function fortuneToWorkbook(sheets: SheetData[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const ws: XLSX.WorkSheet = {};
    let maxR = 0, maxC = 0;

    // Prioritize dense 'data' array if it exists as it contains the most recent live state
    if (sheet.data && Array.isArray(sheet.data) && sheet.data.length > 0) {
      sheet.data.forEach((row, r) => {
        if (!row) return;
        row.forEach((cell, c) => {
          if (cell && cell.v !== undefined && cell.v !== null) {
            maxR = Math.max(maxR, r);
            maxC = Math.max(maxC, c);
            const addr = XLSX.utils.encode_cell({ r, c });
            const val = cell.v;
            const formula = cell.f;
            
            ws[addr] = { 
              v: val, 
              t: typeof val === 'number' ? 'n' : typeof val === 'boolean' ? 'b' : 's',
              f: formula ? (formula.startsWith('=') ? formula.substring(1) : formula) : undefined
            };
          }
        });
      });
    } else if (sheet.celldata && Array.isArray(sheet.celldata)) {
      // Fallback to sparse 'celldata'
      sheet.celldata.forEach(cell => {
        if (cell.v) {
          maxR = Math.max(maxR, cell.r);
          maxC = Math.max(maxC, cell.c);
          const addr = XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
          const val = cell.v.v;
          const formula = (cell.v as any).f;
          
          ws[addr] = { 
            v: val, 
            t: typeof val === 'number' ? 'n' : typeof val === 'boolean' ? 'b' : 's',
            f: formula ? (formula.startsWith('=') ? formula.substring(1) : formula) : undefined
          };
        }
      });
    }

    if (maxR === 0 && maxC === 0 && Object.keys(ws).length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), sheet.name || 'Sheet1');
    } else {
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
      XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
    }
  });

  return wb;
}

// ---------------------------------------------------------------
// Helpers to parse the stored content (either JSON/Array or Base64)
// ---------------------------------------------------------------
export function parseExcelContent(content: string): SheetData[] {
  if (!content) return [{ name: 'Sheet1', celldata: [] }];
  const trimmed = content.trim();

  // 1. Check if it's Base64 XLSX/XLS (Doesn't start with JSON markers)
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{') && trimmed.length > 30) {
    try {
      // Validate if it's actually base64 before trying to read
      if (/^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
        const wb = XLSX.read(trimmed, { type: 'base64' });
        return workbookToFortune(wb);
      }
    } catch (err) { 
      console.error("ExcelUtils: Base64 parse failed:", err);
    }
  }

  // 2. Fallback to JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (parsed[0]?.name !== undefined) return parsed as SheetData[];
      if (Array.isArray(parsed[0])) {
        const celldata: CellData[] = [];
        (parsed as any[][]).forEach((row, r) =>
          row.forEach((v, c) => {
            if (v !== null && v !== undefined && v !== '') {
              celldata.push({ r, c, v: { v, m: String(v) } });
            }
          })
        );
        return [{ name: 'Sheet1', celldata }];
      }
    }
  } catch { /* ignore */ }

  return [{ name: 'Sheet1', celldata: [] }];
}

export function excelToBase64(content: string): string {
    if (!content) return "";
    
    // If it's already a valid base64 of an Excel file, don't re-convert if possible
    // (though re-converting ensures consistency of the FortuneSheet -> Workbook path)
    
    const sheets = parseExcelContent(content);
    const wb = fortuneToWorkbook(sheets);
    return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
