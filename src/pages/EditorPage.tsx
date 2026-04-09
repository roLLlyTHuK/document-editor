import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import WordEditor from '../components/WordEditor';
import ExcelEditor from '../components/ExcelEditor';
import { ArrowLeft, Cloud, Check, Share2, X, Copy } from 'lucide-react';

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

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    if (!id) return;
    
    if (id.startsWith('local_')) {
       const localStr = localStorage.getItem(`doc_${id}`);
       if (localStr) {
          const localDoc = JSON.parse(localStr);
          setDoc(localDoc);
          setContent(localDoc.content || '');
          setTitle(localDoc.title || '');
          setIsOwner(true); // Local docs are always owned by the current session logically
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
    } else {
      navigate('/');
    }
  };

  const handleSaveToCloud = async () => {
    if (!id || !doc || !isOwner) return;
    setSaving(true);
    setSaved(false);

    if (id.startsWith('local_')) {
       const updatedDoc = { ...doc, content, title };
       localStorage.setItem(`doc_${id}`, JSON.stringify(updatedDoc));
    } else {
       const { error } = await supabase.from('documents').update({ content, title }).eq('id', id);
       if(error) console.error("Update error:", error);
    }
    
    setSaving(false);
    setSaved(true);
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
      <div className="topbar">
         <div className="flex-row">
            <button className="btn" style={{ padding: '8px', border: 'none' }} onClick={() => navigate('/')}>
               <ArrowLeft size={18} />
            </button>
            <input 
               type="text" 
               className="input" 
               style={{ background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 500, width: '300px', outline: 'none' }} 
               value={title} 
               onChange={(e) => setTitle(e.target.value)} 
               placeholder="Document Title"
               readOnly={!isOwner}
            />
            {!isOwner && <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface)', padding: '4px 8px', borderRadius: '4px' }}>View Only</span>}
         </div>
         
         <div className="flex-row">
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
