import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import './AppLayout.css';

export const AppLayout: React.FC = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main-viewport">
        <Header />
        <main className="app-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
