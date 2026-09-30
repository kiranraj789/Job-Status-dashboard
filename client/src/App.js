import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ListChecks, GitBranch, Bell, 
  Activity, Settings
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import JobsList from './pages/JobsList';
import JobDetail from './pages/JobDetail';
import DependencyGraph from './pages/DependencyGraph';
import Alerts from './pages/Alerts';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jobs', label: 'Batch Jobs', icon: ListChecks },
  { path: '/dependencies', label: 'Dependencies', icon: GitBranch },
  { path: '/alerts', label: 'Alerts', icon: Bell },
];

function App() {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-text">BatchMonitor</span>
          </div>
          <span className="logo-badge">Enterprise</span>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink 
              key={path} 
              to={path} 
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <Activity size={14} className="pulse" />
            <span>System Online</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/dependencies" element={<DependencyGraph />} />
          <Route path="/alerts" element={<Alerts />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
