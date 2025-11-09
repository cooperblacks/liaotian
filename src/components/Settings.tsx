// src/components/Settings.tsx
import { useState } from 'react';
import { supabase, Profile as ProfileType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BadgeCheck, Mail, Lock, User, AlertCircle, CheckCircle, Settings as SettingsLucideIcon, Check } from 'lucide-react';
import { Themes } from './Themes';

export const Settings = () => {
  // Use global state and new update function from context
  const { user, profile, updateProfile } = useAuth();
  
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Removed: local profile state and loadProfile function/useEffect.

  const handleThemeChange = async (newTheme: string) => {
    if (!user?.id || !profile) return;
    setLoading(true);
    
    // 1. Update database
    const { error } = await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
    setLoading(false);
    
    if (!error) {
      // 2. SUCCESS: Update global state immediately (Theme applied instantly)
      updateProfile({ ...profile, theme: newTheme }); 
      setMessage({ type: 'success', text: 'Theme updated!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to update theme.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUsernameChange = async () => {
    if (!user?.id || !profile || newUsername === profile.username || !newUsername.trim()) return;
    setLoading(true);
    
    // Check if username is taken
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', newUsername.toLowerCase()).maybeSingle();
    if (existing) {
      setMessage({ type: 'error', text: 'Username already taken.' });
      setLoading(false);
      return;
    }
    
    // 1. Update database
    const { error } = await supabase.from('profiles').update({ username: newUsername.toLowerCase() }).eq('id', user.id);
    setLoading(false);
    
    if (!error) {
      // 2. SUCCESS: Update global state immediately
      updateProfile({ ...profile, username: newUsername.toLowerCase() });
      setMessage({ type: 'success', text: 'Username updated!' });
      setNewUsername('');
    } else {
      setMessage({ type: 'error', text: 'Failed to update username.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEmailChange = async () => {
    if (!user?.id || !newEmail.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);
    if (!error) {
      setMessage({ type: 'success', text: 'Email updated! Check your inbox for confirmation.' });
      setNewEmail('');
    } else {
      setMessage({ type: 'error', text: error.message || 'Failed to update email.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePasswordChange = async () => {
    if (!user?.id || newPassword !== confirmPassword || newPassword.length < 6) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (!error) {
      setMessage({ type: 'success', text: 'Password updated!' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: error.message || 'Failed to update password.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleVerificationApply = async () => {
    if (!user?.id || !reason.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ verification_request: reason })
      .eq('id', user.id);
    setLoading(false);
    if (!error) {
      setMessage({ type: 'success', text: 'Verification request submitted!' });
      setShowApply(false);
      setReason('');
      // Reload profile to show pending status
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) updateProfile(data);
    } else {
      setMessage({ type: 'error', text: 'Failed to submit request.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 py-6 space-y-6 bg-[rgb(var(--color-background))) text-[rgb(var(--color-text))]" >
      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <section className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border border-[rgb(var(--color-border)))" >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[rgb(var(--color-text))]" ><User size={20} /> Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[rgb(var(--color-text))]" >Display Name</label>
            <p className="text-[rgb(var(--color-text))]">{profile.display_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[rgb(var(--color-text))]" >Username</label>
            <div className="flex gap-2 items-center">
              <span className="text-[rgb(var(--color-text))] font-mono">@{profile.username}</span>
              <button
                onClick={() => setNewUsername('')}
                className="px-3 py-1 text-xs bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-full hover:bg-[rgba(var(--color-primary),1)] transition"
              >
                Edit
              </button>
            </div>
            {newUsername !== '' && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="New username"
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] text-[rgb(var(--color-text))]"
                />
                <button
                  onClick={handleUsernameChange}
                  disabled={loading}
                  className="w-full py-2 bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-lg hover:bg-[rgba(var(--color-primary),1)] disabled:bg-[rgb(var(--color-border))] transition"
                >
                  {loading ? '...' : 'Update Username'}
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[rgb(var(--color-text))]" >Email</label>
            <div className="flex gap-2 items-center">
              <span className="text-[rgb(var(--color-text))]" >{user.email}</span>
              <button
                onClick={() => setNewEmail('')}
                className="px-3 py-1 text-xs bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-full hover:bg-[rgba(var(--color-primary),1)] transition"
              >
                Edit
              </button>
            </div>
            {newEmail !== '' && (
              <div className="mt-2 space-y-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email"
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] text-[rgb(var(--color-text))]"
                />
                <button
                  onClick={handleEmailChange}
                  disabled={loading}
                  className="w-full py-2 bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-lg hover:bg-[rgba(var(--color-primary),1)] disabled:bg-[rgb(var(--color-border))] transition"
                >
                  {loading ? '...' : 'Update Email'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Theme Section */}
      <section className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border border-[rgb(var(--color-border)))" >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[rgb(var(--color-text))]" ><SettingsLucideIcon size={20} /> Appearance</h2>
        <Themes currentTheme={profile.theme || 'lt-classic'} onChange={handleThemeChange} loading={loading} />
      </section>

      {/* Password Section */}
      <section className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border border-[rgb(var(--color-border)))" >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[rgb(var(--color-text))]" ><Lock size={20} /> Password</h2>
        <div className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] text-[rgb(var(--color-text))]"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] text-[rgb(var(--color-text))]"
          />
          <button
            onClick={handlePasswordChange}
            disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
            className="w-full py-2 bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-lg hover:bg-[rgba(var(--color-primary),1)] disabled:bg-[rgb(var(--color-border))] transition flex items-center justify-center gap-2"
          >
            <Lock size={16} />
            {loading ? '...' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* Verification Section */}
      <section className="bg-[rgb(var(--color-surface))] p-6 rounded-xl border border-[rgb(var(--color-border)))" >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[rgb(var(--color-text))]" ><BadgeCheck size={20} /> Verification</h2>
        {profile.verified ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={20} />
            <span>Verified</span>
            <Check size={20} className="text-[rgb(var(--color-accent))]" />
          </div>
        ) : profile.verification_request ? (
          <div className="text-yellow-600">Pending: {profile.verification_request}</div>
        ) : (
          <>
            <p className="text-[rgb(var(--color-text-secondary))] mb-4"> Apply for verification badge.</p>
            <button
              onClick={() => setShowApply(true)}
              className="px-4 py-2 bg-[rgba(var(--color-accent),1)] text-[rgb(var(--color-text-on-primary))] rounded-lg hover:bg-[rgba(var(--color-primary),1)] transition"
            >
              Apply for Verification
            </button>
            {showApply && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for verification (e.g., public figure, brand, etc.)"
                  rows={3}
                  className="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] resize-none text-[rgb(var(--color-text))]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleVerificationApply}
                    disabled={loading || !reason.trim()}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-[rgb(var(--color-border))] transition"
                  >
                    {loading ? '...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => { setShowApply(false); setReason(''); }}
                    className="px-4 py-2 bg-[rgb(var(--color-surface-hover))] text-[rgb(var(--color-text))] rounded-lg hover:bg-[rgb(var(--color-border))] transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
