'use client';

import { useState, useEffect } from 'react';
import { Lock, LogOut, Trash2, Download, Eye, EyeOff } from 'lucide-react';

interface User {
  email: string;
  password: string;
  createdAt: string;
  verified?: boolean;
}

interface PendingSignup {
  email: string;
  password: string;
  verificationCode: string;
  createdAt: string;
}

interface InboxMessage {
  email: string;
  code: string;
  timestamp: string;
}

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<Record<string, User>>({});
  const [pendingSignups, setPendingSignups] = useState<Record<string, PendingSignup>>({});
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'inbox' | 'stats'>('stats');

  const ADMIN_PASSWORD = 'admin123456';

  useEffect(() => {
    if (authenticated) {
      loadData();
    }
  }, [authenticated]);

  const loadData = () => {
    const usersData = JSON.parse(localStorage.getItem('songmaker-users') || '{}');
    const pendingData = JSON.parse(localStorage.getItem('songmaker-pending-signups') || '{}');
    const inboxData = JSON.parse(localStorage.getItem('songmaker-inbox') || '[]');
    
    setUsers(usersData);
    setPendingSignups(pendingData);
    setInbox(inboxData);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPassword('');
    } else {
      alert('Invalid password');
    }
  };

  const deleteUser = (email: string) => {
    if (confirm(`Delete user ${email}?`)) {
      const newUsers = { ...users };
      delete newUsers[email];
      setUsers(newUsers);
      localStorage.setItem('songmaker-users', JSON.stringify(newUsers));
    }
  };

  const deletePending = (email: string) => {
    if (confirm(`Delete pending signup ${email}?`)) {
      const newPending = { ...pendingSignups };
      delete newPending[email];
      setPendingSignups(newPending);
      localStorage.setItem('songmaker-pending-signups', JSON.stringify(newPending));
    }
  };

  const deleteInboxMessage = (index: number) => {
    const newInbox = inbox.filter((_, i) => i !== index);
    setInbox(newInbox);
    localStorage.setItem('songmaker-inbox', JSON.stringify(newInbox));
  };

  const clearAll = () => {
    if (confirm('Clear ALL data? This cannot be undone.')) {
      setUsers({});
      setPendingSignups({});
      setInbox([]);
      localStorage.setItem('songmaker-users', '{}');
      localStorage.setItem('songmaker-pending-signups', '{}');
      localStorage.setItem('songmaker-inbox', '[]');
    }
  };

  const exportData = () => {
    const data = {
      users,
      pendingSignups,
      inbox,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `songmaker-admin-export-${Date.now()}.json`;
    a.click();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-8">
              <Lock className="w-8 h-8 text-purple-400 mr-3" />
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-purple-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
              <button
                type="submit"
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all duration-200"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    totalUsers: Object.keys(users).length,
    totalPending: Object.keys(pendingSignups).length,
    totalInbox: inbox.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-slate-400">Manage SongMaker data</p>
          </div>
          <button
            onClick={() => setAuthenticated(false)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['stats', 'users', 'pending', 'inbox'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Verified Users</p>
              <p className="text-4xl font-bold text-purple-400">{stats.totalUsers}</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Pending Signups</p>
              <p className="text-4xl font-bold text-pink-400">{stats.totalPending}</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Inbox Messages</p>
              <p className="text-4xl font-bold text-blue-400">{stats.totalInbox}</p>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Verified Users ({stats.totalUsers})</h2>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded text-sm"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPasswords ? 'Hide' : 'Show'} Passwords
              </button>
            </div>
            
            {Object.keys(users).length === 0 ? (
              <p className="text-slate-400">No users yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(users).map(([email, user]) => (
                  <div key={email} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{email}</p>
                      <p className="text-slate-400 text-sm">
                        Password: {showPasswords ? user.password : '••••••••'}
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Created: {new Date(user.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteUser(email)}
                      className="ml-4 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending Signups Tab */}
        {activeTab === 'pending' && (
          <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Pending Signups ({stats.totalPending})</h2>
            
            {Object.keys(pendingSignups).length === 0 ? (
              <p className="text-slate-400">No pending signups</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(pendingSignups).map(([email, signup]) => (
                  <div key={email} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{email}</p>
                      <p className="text-slate-400 text-sm">
                        Code: <span className="font-mono text-purple-400">{signup.verificationCode}</span>
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Created: {new Date(signup.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deletePending(email)}
                      className="ml-4 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inbox Tab */}
        {activeTab === 'inbox' && (
          <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Mock Inbox ({stats.totalInbox})</h2>
            
            {inbox.length === 0 ? (
              <p className="text-slate-400">No inbox messages</p>
            ) : (
              <div className="space-y-3">
                {inbox.map((msg, idx) => (
                  <div key={idx} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{msg.email}</p>
                      <p className="text-slate-400 text-sm">
                        Code: <span className="font-mono text-blue-400">{msg.code}</span>
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteInboxMessage(idx)}
                      className="ml-4 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8 flex-wrap">
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}
