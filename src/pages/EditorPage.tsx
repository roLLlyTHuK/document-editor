import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import WordEditor from '../components/WordEditor';
import ExcelEditor from '../components/ExcelEditor';
import { ArrowLeft, Cloud, Check, Share2, X, Copy, FolderOpen, FileText, Table } from 'lucide-react';

export default function EditorPage() {
  const { id } = useParams<{id: string}>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState('');
  
  const [isOwner, setIsOwner] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    fetchDocument();
    fetchAllDocs();
  }, [id]);

  // Auto-save every 10 seconds for cloud docs
  useEffect(() => {
    if (!id || id.startsWith('local_') || !isOwner) return;
    
    const interval = setInterval(() => {
      console.log("EditorPage: Auto-saving...");
      handleSaveToCloud();
    }, 10000);
    
    // Attempt save on exit/close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
       handleSaveToCloud();
       // Standard "are you sure" message
       e.preventDefault();
       e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
       clearInterval(interval);
       window.removeEventListener('beforeunload', handleBeforeUnload);
       handleSaveToCloud(); // Attempt final save on unmount
    };
  }, [id, isOwner]);

  const trackHistory = (d: any) => {
    if (!d || !d.id) return;
    const historyStr = localStorage.getItem('doc_history') || '[]';
    let history: any[] = JSON.parse(historyStr);
    
    // Remove if already exists (to move to top)
    history = history.filter(item => item.id !== d.id);
    
    // Add to top
    history.unshift({
      id: d.id,
      title: d.title || 'Untitled',
      type: d.type,
      last_opened: new Date().toISOString()
    });
    
    // Limit to 10 items
    if (history.length > 10) history = history.slice(0, 10);
    
    localStorage.setItem('doc_history', JSON.stringify(history));
  };

  const fetchDocument = async () => {
    if (!id) return;
    
    if (id.startsWith('local_')) {
       const key = `doc_${id}`;
       const localStr = localStorage.getItem(key);
       if (localStr) {
          const localDoc = JSON.parse(localStr);
          setDoc(localDoc);
          setContent(localDoc.content || '');
          setTitle(localDoc.title || '');
          setIsOwner(true);
          trackHistory({...localDoc, id});
       }
       return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    
    if (!error && data) {
      setDoc(data);
      setContent(data.content || '');
      setTitle(data.title || '');
      setIsPublic(data.is_public || false);
      setIsOwner(user?.id === data.user_id);
      trackHistory(data);
    } else {
      navigate('/');
    }
  };

  const fetchAllDocs = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;
    
    const { data, error } = await supabase.from('documents')
      .select('id, title, type, created_at')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false });
    
    setAllDocs(data || []);
    if (error) console.error("EditorPage: fetchAllDocs error:", error);

    // History & Local drafts
    const histStr = localStorage.getItem('doc_history') || '[]';
    const histDocs: any[] = JSON.parse(histStr);

    const localDrafts: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
       const key = localStorage.key(i);
       if (key?.startsWith('doc_local_')) {
          try {
             const d = JSON.parse(localStorage.getItem(key)!);
             localDrafts.push({...d, id: key.replace('doc_', '')});
          } catch {}
       }
    }
    setRecentDocs([...histDocs, ...localDrafts]);
  };

  const handleSaveToCloud = async () => {
    if (!id || !doc) return;
    setSaving(true);
    setSaved(false);

    let finalContent = content;
    
    try {
      if (doc.type === 'word' && (window as any).getWordBase64) {
        finalContent = await (window as any).getWordBase64();
      } else if (doc.type === 'excel' && (window as any).getExcelBase64) {
        finalContent = await (window as any).getExcelBase64();
      }
    } catch (e) {
      console.error("EditorPage: Conversion error:", e);
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
       setSaving(false);
       return;
    }

    if (id.startsWith('local_')) {
       const newDoc = {
         title: title || doc.title,
         type: doc.type,
         user_id: authData.user.id,
         content: finalContent
       };

       const { data, error } = await supabase.from('documents').insert([newDoc]).select().single();
       
       if (!error && data) {
          localStorage.removeItem(`doc_${id}`);
          setSaved(true);
          setContent(finalContent); // Commit binary to state
          setLastSaved(new Date().toLocaleTimeString());
          navigate(`/document/${data.id}`, { replace: true });
       } else {
          const updatedDoc = { ...doc, content: finalContent, title };
          localStorage.setItem(`doc_${id}`, JSON.stringify(updatedDoc));
          setContent(finalContent); // Commit binary to state
          setSaved(true);
       }
    } else {
       const { error } = await supabase.from('documents').update({ content: finalContent, title }).eq('id', id);
       if(!error) {
          setSaved(true);
          setContent(finalContent); // Commit binary to state
          setLastSaved(new Date().toLocaleTimeString());
       }
    }
    
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleShare = async () => {
    if (!isOwner || id?.startsWith('local_')) {
        alert("Только владелец облачного документа может им делиться.");
        return;
    }
    if (!isPublic) {
       const { error } = await supabase.from('documents').update({ is_public: true }).eq('id', id);
       if (!error) setIsPublic(true);
    }
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Ссылка скопирована!');
  };

  if (!doc) {
    return <div className="app-container"><div style={{ margin: 'auto', color: 'white' }}>Loading document...</div></div>;
  }

  const shareUrl = window.location.href;

  return (
    <div className="main-content">
      <div className="topbar" style={{ position: 'relative' }}>
         <div className="flex-row">
            <button className="btn" style={{ padding: '8px', border: 'none' }} onClick={() => navigate('/')}>
               <ArrowLeft size={18} />
            </button>
            <div style={{ position: 'relative' }}>
                <button 
                  className="btn" 
                  onClick={() => setShowDocSelector(!showDocSelector)}
                  style={{ background: 'var(--surface)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                   <FolderOpen size={16} />
                   Мои файлы
                </button>
                {showDocSelector && (
                  <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', width: '280px', zIndex: 200, padding: '12px', maxHeight: '500px', overflowY: 'auto', background: '#1a1b26', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                     
                     <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 4px' }}>Облачные файлы</p>
                         {allDocs.map(d => (
                            <div 
                              key={d.id} 
                              className="flex-row" 
                              style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', background: d.id === id ? 'var(--surface-hover)' : 'transparent', gap: '8px', alignItems: 'center', transition: 'background 0.2s' }}
                              onClick={() => { navigate(`/document/${d.id}`); setShowDocSelector(false); }}
                            >
                               {d.type === 'word' ? <FileText size={14} color="#3b82f6" /> : <Table size={14} color="#10b981" />}
                               <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{d.title || 'Untitled'}</span>
                            </div>
                         ))}
                         {allDocs.length === 0 && <div style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--text-muted)' }}>Нет файлов в облаке</div>}
                     </div>

                      {recentDocs.length > 0 && (
                         <div>
                            <p style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 4px' }}>История изменений</p>
                            {recentDocs.map(d => {
                              return (
                                <div 
                                  key={d.id} 
                                  className="flex-row" 
                                  style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', background: d.id === id ? 'var(--surface-hover)' : 'transparent', gap: '8px', alignItems: 'center', opacity: 0.8 }}
                                  onClick={() => { navigate(`/document/${d.id}`); setShowDocSelector(false); }}
                                >
                                   {d.type === 'word' ? <FileText size={14} color="#3b82f6" /> : <Table size={14} color="#10b981" />}
                                   <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{d.title || 'Untitled'}</span>
                                </div>
                              );
                            })}
                         </div>
                      )}
                  </div>
                )}
            </div>
            <input 
               type="text" 
               className="input" 
               style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 500, width: '200px', outline: 'none', marginLeft: '8px' }} 
               value={title} 
               onChange={(e) => setTitle(e.target.value)} 
               placeholder="Document Title"
               readOnly={!isOwner}
            />
            {!isOwner && <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface)', padding: '4px 8px', borderRadius: '4px' }}>View Only</span>}
         </div>
         
         <div className="flex-row">
            {lastSaved && <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>Saved at {lastSaved}</span>}
            {saved && <span style={{ color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> Saved</span>}
            
            {isOwner && (
                <>
                    <button className="btn" onClick={handleShare} style={{ background: 'var(--surface-hover)' }}>
                       <Share2 size={16} /> Поделиться
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveToCloud} disabled={saving}>
                       <Cloud size={16} /> {saving ? 'Saving...' : 'Save to Cloud'}
                    </button>
                </>
            )}
         </div>
      </div>
      
      {doc.type === 'word' ? (
         <WordEditor content={content} onChange={setContent} title={title} />
      ) : (
         <ExcelEditor content={content} onChange={setContent} title={title} />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
           <div className="glass-panel flex-col" style={{ background: '#1a1b26', padding: '24px', width: '400px', gap: '16px' }}>
              <div className="flex-row space-between" style={{ alignItems: 'center' }}>
                 <h3 style={{ margin: 0 }}>Поделиться документом</h3>
                 <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowShareModal(false)} />
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Любой авторизованный пользователь с этой ссылкой сможет просматривать документ.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <input type="text" className="input" value={shareUrl} readOnly />
                 <button className="btn btn-primary" onClick={handleCopyLink}><Copy size={16} /></button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                 <a className="btn" style={{ background: '#0088cc', color: '#fff', flex: 1, border: 'none' }} href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title || 'Document')}`} target="_blank" rel="noreferrer">Telegram</a>
                 <a className="btn" style={{ background: '#25D366', color: '#fff', flex: 1, border: 'none' }} href={`https://api.whatsapp.com/send?text=${encodeURIComponent((title || 'Document') + " " + shareUrl)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                 <a className="btn" style={{ background: '#7360f2', color: '#fff', flex: 1, border: 'none' }} href={`viber://forward?text=${encodeURIComponent((title || 'Document') + " " + shareUrl)}`} target="_blank" rel="noreferrer">Viber</a>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
