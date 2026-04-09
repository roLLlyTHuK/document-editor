import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Loader2, MailCheck } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAuthMessage(null);
    
    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setAuthMessage('Registration successful! Please check your email to confirm your account.');
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel flex-col">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <Shield size={48} color="var(--primary)" />
        </div>
        <div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">
            {isRegistering ? 'Create your account' : 'Sign in to your document workspace'}
          </p>
        </div>
        
        {authMessage && (
          <div style={{ padding: '12px', background: 'rgba(158, 206, 106, 0.1)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <MailCheck size={18} />
            <span style={{ fontSize: '13px' }}>{authMessage}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="flex-col" style={{ gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@example.com"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isRegistering ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span 
            style={{ color: 'var(--primary)', cursor: 'pointer' }}
            onClick={() => { setIsRegistering(!isRegistering); setError(null); setAuthMessage(null); }}
          >
            {isRegistering ? 'Sign in' : 'Register'}
          </span>
        </div>
      </div>
    </div>
  );
}
