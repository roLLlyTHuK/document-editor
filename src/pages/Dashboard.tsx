import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Table as TableIcon, Plus, LogOut, Trash2, Shield, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let cloudDocs: any[] = [];

    if (user) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Dashboard: Fetch docs error:", error);
      } else if (data) {
        cloudDocs = data;
      }
    }

    // Get History from localStorage
    const histStr = localStorage.getItem('doc_history') || '[]';
    let histDocs: any[] = JSON.parse(histStr);

    // Get strictly local draft docs (unsaved)
    const localDrafts: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('doc_local_')) {
        try {
          const d = JSON.parse(localStorage.getItem(key)!);
          localDrafts.push({ ...d, id: key.replace('doc_', '') });
        } catch { }
      }
    }

    setDocuments(cloudDocs);
    setHistory([...histDocs, ...localDrafts]);
  };

  const createDocument = async (type: 'word' | 'excel', initialContent?: string, initialTitle?: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      alert("Пожалуйста, войдите в систему.");
      return;
    }

    // Initialize with blank valid binary content if none provided
    let content = initialContent;
    if (!content) {
      if (type === 'word') {
        // A minimal blank docx (Base64)
        content = "";
      } else {
        // A minimal blank xlsx via SheetJS would be safer, but let's use a placeholder or better: initialize via helper
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), "Sheet1");
        content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      }
    }

    const newDoc = {
      title: initialTitle || `Untitled ${type === 'word' ? 'Document' : 'Spreadsheet'}`,
      type,
      user_id: user.user.id,
      content: content
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(newDoc)
      .select()
      .single();

    if (!error && data) {
      console.log("Dashboard: Document created in Supabase:", data.id);
      navigate(`/document/${data.id}`);
    } else {
      if (error) console.error("Dashboard: Supabase insert error:", error);
      const localId = 'local_' + Date.now();
      localStorage.setItem(`doc_${localId}`, JSON.stringify({ ...newDoc, id: localId, created_at: new Date().toISOString() }));
      console.warn("Dashboard: Falling back to local storage for doc:", localId);
      navigate(`/document/${localId}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const type = (ext === 'xlsx' || ext === 'xls' || ext === 'csv') ? 'excel' : 'word';

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await createDocument(type, base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (id.startsWith('local_')) {
      localStorage.removeItem(`doc_${id}`);
      fetchDocuments();
      return;
    }
    await supabase.from('documents').delete().eq('id', id);
    fetchDocuments();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <FileText size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '18px' }}>Workspace</h2>
        </div>
        <div className="sidebar-nav">
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }} onClick={() => createDocument('word')}>
            <Plus size={16} /> Новый документ (.docx)
          </button>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }} onClick={() => createDocument('excel')}>
            <Plus size={16} /> Новая таблица (.xlsx)
          </button>

          <input type="file" id="dash-upload" style={{ display: 'none' }} onChange={handleFileUpload} accept=".docx,.doc,.xlsx,.xls,.csv" />
          <button className="btn" style={{ width: '100%', marginBottom: '24px', background: 'var(--surface-hover)' }} onClick={() => document.getElementById('dash-upload')?.click()}>
            <Upload size={16} /> Открыть с диска
          </button>

          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '8px' }}>
              Облачное хранилище
            </div>
            {documents.map(doc => (
              <Link to={`/document/${doc.id}`} className="nav-item space-between" key={doc.id}>
                <div className="flex-row">
                  {doc.type === 'word' ? <FileText size={16} color="#3b82f6" /> : <TableIcon size={16} color="#10b981" />}
                  <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{doc.title}</span>
                </div>
                <Trash2 size={14} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={(e) => handleDelete(doc.id, e)} />
              </Link>
            ))}
            {documents.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '8px' }}>Нет файлов в облаке</div>
            )}
          </div>

          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '8px' }}>
              История изменений
            </div>
            {history.map(doc => {
              return (
                <Link to={`/document/${doc.id}`} className="nav-item space-between" key={doc.id} style={{ opacity: 0.85 }}>
                  <div className="flex-row">
                    {doc.type === 'word' ? <FileText size={16} color="#3b82f6" /> : <TableIcon size={16} color="#10b981" />}
                    <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{doc.title}</span>
                  </div>
                  {doc.id.startsWith('local_') && (
                    <Trash2 size={14} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={(e) => handleDelete(doc.id, e)} />
                  )}
                </Link>
              );
            })}
            {history.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '8px' }}>История пуста</div>
            )}
          </div>
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
      <div className="main-content flex-col" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Shield size={64} color="var(--border)" style={{ marginBottom: '24px' }} />
        <h2 style={{ color: 'var(--text-muted)' }}>Select a document or create a new one</h2>
      </div>
    </div>
  );
}
