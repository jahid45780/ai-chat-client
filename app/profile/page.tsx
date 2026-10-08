'use client';

import { FormEvent, useState } from 'react';
import { LockKeyhole, Menu, Save } from 'lucide-react';
import { ChatSidebar } from '@/components/sidebar/ChatSidebar';
import { Protected } from '@/components/layout/Protected';
import { useAuth } from '@/hooks/useAuth';
import { api, errorMessage } from '@/lib/api/client';

export default function Profile() {
  return <Protected><ProfileContent /></Protected>;
}

function ProfileContent() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await api.patch('/users/me', { name });
      await refresh();
      setNotice('Profile updated.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    try {
      await api.patch('/users/change-password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setNotice('Password changed.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return <div className="chat-layout">
    <div className={`sidebar-overlay ${open ? 'visible' : ''}`} onClick={() => setOpen(false)} />
    <div className={`sidebar-wrap ${open ? 'drawer-open' : ''}`}><ChatSidebar onClose={() => setOpen(false)} /></div>
    <main className="settings-main">
      <header className="chat-header"><button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><span>Profile</span></header>
      <div className="settings-content">
        <span className="eyebrow">Your account</span><h1>Profile</h1>
        <p className="settings-lead">Manage your personal information and sign-in details.</p>
        {notice && <div className="notice-banner" role="status">{notice}</div>}
        <section className="settings-panel">
          <div className="profile-heading"><span className="avatar large">{user?.name?.[0]?.toUpperCase() || 'U'}</span><div><h2>{user?.name}</h2><p>{user?.email}</p></div></div>
          <form onSubmit={save}>
            <label className="form-field"><span>Full name</span><input value={name} onChange={event => setName(event.target.value)} required maxLength={80} /></label>
            <label className="form-field"><span>Email address</span><input value={user?.email || ''} readOnly disabled /></label>
            <button className="save-button" disabled={busy}><Save size={16} />{busy ? 'Saving…' : 'Save profile'}</button>
          </form>
        </section>
        <section className="settings-panel">
          <div className="panel-title"><LockKeyhole size={18} /><div><h2>Change password</h2><p>Choose a strong password with at least 8 characters.</p></div></div>
          <form onSubmit={changePassword}>
            <label className="form-field"><span>Current password</span><input type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} required /></label>
            <label className="form-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={next} onChange={event => setNext(event.target.value)} required /></label>
            <button className="save-button">Update password</button>
          </form>
        </section>
      </div>
    </main>
  </div>;
}
