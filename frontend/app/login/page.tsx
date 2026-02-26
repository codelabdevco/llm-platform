'use client';
import { useState } from 'react';
import { useAuth } from '../../lib/store';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'register') {
        const { api } = await import('../../lib/api');
        const data: any = await api.post('/auth/register', { email, password, name });
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        await login(email, password);
      }
      router.push('/chat');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: 400, background: '#161b27', border: '1px solid #1e2d45', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LLM Platform
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>ระบบแชท AI ภายในองค์กร</p>
        </div>

        <div style={{ display: 'flex', gap: 4, background: '#0f1117', borderRadius: 8, padding: 4, marginBottom: 24 }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: 6,
              background: tab === t ? '#1e2d45' : 'transparent',
              color: tab === t ? '#e2e8f0' : '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}>
              {t === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'register' && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" required
              style={{ padding: '12px', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="อีเมล" required
            style={{ padding: '12px', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="รหัสผ่าน (8+ ตัวอักษร)" required
            style={{ padding: '12px', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }} />

          {error && <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            padding: '12px', background: loading ? '#1e2d45' : 'linear-gradient(135deg,#3b82f6,#6d28d9)',
            border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'กำลังดำเนินการ...' : tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>
      </div>
    </div>
  );
}
