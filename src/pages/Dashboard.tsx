import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Table as TableIcon, Plus, LogOut, Trash2, Shield } from 'lucide-react';

export default function Dashboard() {
  const [documents, setDocuments] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    // Check if the table exists by trying to select from it
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    
    // We will store docs in a table called 'documents'
    // id, created_at, user_id, title, type (word/excel), content
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, type, created_at')
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false });

    // If table doesn't exist, this will error. We handle it gracefully for dev.
    if (!error && data) {
      setDocuments(data);
    } else if (error) {
       console.error("Fetch docs error:", error);
       // Table might not exist yet, we will just show local state or empty
       setDocuments([]);
    }
  };

  const createDocument = async (type: 'word' | 'excel') => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const newDoc = {
      title: `Untitled ${type === 'word' ? 'Document' : 'Spreadsheet'}`,
      type,
      user_id: user.user.id,
      content: type === 'word' ? '<p>Start typing...</p>' : JSON.stringify([['', '', ''], ['', '', ''], ['', '', '']])
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(newDoc)
      .select()
      .single();

    if (!error && data) {
      navigate(`/document/${data.id}`);
    } else {
      // Fallback to local storage route creation if db table missing
      alert("Note: Saving to local storage since Supabase table 'documents' might not exist yet.");
      const localId = 'local_' + Date.now();
      localStorage.setItem(`doc_${localId}`, JSON.stringify({...newDoc, id: localId}));
      navigate(`/document/${localId}`);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if(id.startsWith('local_')) {
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
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }} onClick={() => createDocument('word')}>
            <Plus size={16} /> New Word Doc
          </button>
          <button className="btn" style={{ width: '100%', marginBottom: '24px' }} onClick={() => createDocument('excel')}>
            <Plus size={16} /> New Excel Doc
          </button>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Recent Documents
          </div>
          {documents.map(doc => (
            <Link to={`/document/${doc.id}`} className="nav-item space-between" key={doc.id}>
              <div className="flex-row">
                 {doc.type === 'word' ? <FileText size={16} /> : <TableIcon size={16} />}
                 <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{doc.title}</span>
              </div>
              <Trash2 size={14} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={(e) => handleDelete(doc.id, e)} />
            </Link>
          ))}
          {documents.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No documents found.</div>
          )}
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
