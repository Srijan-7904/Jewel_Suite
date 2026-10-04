import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database, ShieldCheck, LogOut, User as UserIcon, Clock } from 'lucide-react';
import './Header.css';

export const Header: React.FC = () => {
  const { user, logout, health } = useAuth();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="app-header">
      {/* Left: Store identity & system tags */}
      <div className="header-left">
        <h1 className="header-title">Jewel Suite Management</h1>
        <div className="system-status-pills">
          <span className="status-badge status-db">
            <Database size={13} />
            <span>SQLite WAL</span>
          </span>
          <span className="status-badge status-offline">
            <ShieldCheck size={13} />
            <span>100% Offline Ready</span>
          </span>
          {health?.database && (
            <span className="status-badge status-conn">
              <span>DB: {health.database}</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Clock, User profile pill, Logout */}
      <div className="header-right">
        <div className="header-clock font-mono">
          <Clock size={14} className="clock-icon" />
          <span>{time}</span>
        </div>

        <div className="user-profile-pill">
          <div className="user-avatar">
            <UserIcon size={14} />
          </div>
          <div className="user-details">
            <span className="user-name">{user?.username || 'Staff'}</span>
            <span className="user-role badge-gold">{user?.role || 'Admin'}</span>
          </div>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={() => logout()}
          title="Sign out of local terminal"
        >
          <LogOut size={16} />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
};
