'use client';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/store';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'users'>('overview');
  const [editUser, setEditUser] = useState<any>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') { router.push('/chat'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    const [s, u, g] = await Promise.all([
      api.get<any>('/admin/stats'),
      api.get<any>('/admin/users'),
      api.get<any[]>('/admin/usage'),
    ]);
    setStats(s); setUsers(u.users); setUsage(g);
  };

  const updateUser = async () => {
    await api.patch(`/admin/users/${editUser._id}`, {
      isActive: editUser.isActive,
      role: editUser.role,
      tokenLimit: editUser.tokenLimit || null,
    });
    setEditUser(null);
    loadData();
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete user and all their data?')) return;
    await api.delete(`/admin/users/${id}`);
    loadData();
  };

  const costDisplay = (cents: number) => cents < 100 ? `${cents}¢` : `$${(cents / 100).toFixed(2)}`;

  const StatCard = ({ label, value, sub }: any) => (
    <div style={{ background: '#161b27', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  if (!stats) return <div style={{ background: '#0f1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading...</div>;

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', background: '#161b27', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 18, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🛡️ Admin Dashboard
        </span>
        <a href="/chat" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', marginLeft: 'auto' }}>← Back to Chat</a>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#161b27', border: '1px solid #1e2d45', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          {(['overview', 'users'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', border: 'none', borderRadius: 6,
              background: tab === t ? '#1e2d45' : 'transparent',
              color: tab === t ? '#e2e8f0' : '#64748b', cursor: 'pointer', fontWeight: 600,
            }}>
              {t === 'overview' ? '📊 Overview' : '👥 Users'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="TOTAL USERS" value={stats.users.total} sub={`${stats.users.active} active`} />
              <StatCard label="CONVERSATIONS" value={stats.conversations.toLocaleString()} />
              <StatCard label="MESSAGES SENT" value={stats.messages.toLocaleString()} />
              <StatCard label="TOTAL COST" value={costDisplay(stats.totalCostCents)} sub={`${(stats.totalTokens / 1_000_000).toFixed(2)}M tokens`} />
            </div>

            {/* Cost by Model */}
            <div style={{ background: '#161b27', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>💸 Cost by Model</div>
              {stats.costByModel?.map((m: any) => (
                <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e2d45' }}>
                  <span style={{ fontSize: 14 }}>{m._id || 'unknown'}</span>
                  <span style={{ fontSize: 14, color: '#94a3b8' }}>
                    {m.count} msgs · {(m.totalTokens / 1000).toFixed(0)}k tok · {costDisplay(m.totalCost)}
                  </span>
                </div>
              ))}
            </div>

            {/* Top Users */}
            <div style={{ background: '#161b27', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>🏆 Top Users by Usage</div>
              {stats.topUsers?.map((u: any, i: number) => (
                <div key={u._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e2d45' }}>
                  <span style={{ fontSize: 14 }}>#{i + 1} {u.name} <span style={{ color: '#64748b' }}>({u.email})</span></span>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{(u.totalTokensUsed / 1000).toFixed(1)}k tok · {costDisplay(u.totalCost)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'users' && (
          <div style={{ background: '#161b27', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1e2d45' }}>
                  {['Name', 'Email', 'Role', 'Tokens', 'Cost', 'Limit', 'Active', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #1e2d45' }}>
                    <td style={{ padding: '12px 16px', fontSize: 14 }}>{u.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: u.role === 'admin' ? 'rgba(124,58,237,0.2)' : 'rgba(30,45,69,1)', color: u.role === 'admin' ? '#a78bfa' : '#64748b' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{(u.totalTokensUsed / 1000).toFixed(1)}k</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{costDisplay(u.totalCost)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: u.tokenLimit ? '#f59e0b' : '#475569' }}>{u.tokenLimit ? `${(u.tokenLimit / 1000).toFixed(0)}k` : '∞'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: u.isActive ? '#10b981' : '#ef4444', fontSize: 13 }}>{u.isActive ? '✓' : '✗'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditUser({ ...u })} style={{ padding: '4px 10px', background: '#1e2d45', border: 'none', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => deleteUser(u._id)} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#161b27', border: '1px solid #1e2d45', borderRadius: 16, padding: 28, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Edit User: {editUser.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>ROLE</label>
                <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                  style={{ width: '100%', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 8, color: '#e2e8f0', padding: 10 }}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>TOKEN LIMIT (0 = unlimited)</label>
                <input type="number" value={editUser.tokenLimit || 0} onChange={e => setEditUser({ ...editUser, tokenLimit: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 8, color: '#e2e8f0', padding: 10 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="active" checked={editUser.isActive} onChange={e => setEditUser({ ...editUser, isActive: e.target.checked })} />
                <label htmlFor="active" style={{ fontSize: 14 }}>Active</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={updateUser} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditUser(null)} style={{ flex: 1, padding: 10, background: '#1e2d45', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`* { box-sizing: border-box } ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-thumb { background: #2d3f5c }`}</style>
    </div>
  );
}
