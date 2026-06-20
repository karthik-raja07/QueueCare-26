import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { SocketProvider, useSocket } from './context/SocketContext';
import { ReceptionistDashboard } from './components/ReceptionistDashboard';
import { PatientWaitingRoom } from './components/PatientWaitingRoom';
import { DoctorDashboard } from './components/DoctorDashboard';
import { PatientTracker } from './components/PatientTracker';
import { VoiceAnnouncer } from './components/VoiceAnnouncer';
import { 
  ShieldAlert, Activity, Users, LayoutDashboard, Key, 
  Tv, Smartphone, Volume2, Wifi, WifiOff, Clock
} from 'lucide-react';

const HeaderClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-105 border border-slate-205 rounded-full text-xs font-mono text-slate-550 font-semibold shadow-3xs">
      <Clock className="w-3.5 h-3.5 text-indigo-500" />
      <span>{time.toLocaleTimeString()}</span>
    </div>
  );
};

const NavigationHeader: React.FC = () => {
  const { isConnected, isConnecting } = useSocket();
  const location = useLocation();

  // Hide header completely on mobile mobile patient tracker link
  const isTrackingView = location.pathname.startsWith('/track/');

  if (isTrackingView) {
    return null;
  }

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo Brand */}
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200/80 group-hover:scale-105 transition">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1">
                <span>QueueCare</span>
                <span className="text-indigo-600 bg-indigo-50 px-1 rounded text-[10px] font-extrabold uppercase font-mono tracking-wider">v26</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">Real-Time Patient Management</p>
            </div>
          </NavLink>

          {/* Sub Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <NavLink 
              to="/" 
              className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                isActive ? 'bg-white text-indigo-700 shadow-3xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Reception Desk</span>
            </NavLink>

            <NavLink 
              to="/waiting-room" 
              className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                isActive ? 'bg-white text-indigo-700 shadow-3xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Patient TV View</span>
            </NavLink>

            <NavLink 
              to="/doctor" 
              className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                isActive ? 'bg-white text-indigo-700 shadow-3xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Doctor Console</span>
            </NavLink>

            <NavLink 
              to="/track" 
              className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                isActive ? 'bg-white text-indigo-700 shadow-3xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Tracker</span>
            </NavLink>
          </nav>

          {/* Connection badge + Timer clock + Audio announcer controls */}
          <div className="flex items-center gap-3">
            
            {/* Audio vocal reader tool */}
            <VoiceAnnouncer />

            {/* Standard clinical clock */}
            <HeaderClock />

            {/* Connection Telemetry Badge */}
            <div className="flex items-center">
              {isConnected ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase font-mono bg-green-50 border border-green-200 text-green-600 shadow-3xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                  STABLE SYNC
                </span>
              ) : isConnecting ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase font-mono bg-amber-50 border border-amber-200 text-amber-600 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  RECONNECTING...
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase font-mono bg-red-50 border border-red-200 text-red-500">
                  <WifiOff className="w-3 h-3 text-red-500" />
                  DISCONNECTED
                </span>
              )}
            </div>

          </div>

        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around border-t py-2 border-slate-100 gap-1 overflow-x-auto">
          <NavLink 
            to="/" 
            className={({ isActive }) => `px-2 py-1.5 text-[10.5px] font-extrabold flex flex-col items-center gap-0.5 rounded transition ${
              isActive ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Receptionist</span>
          </NavLink>

          <NavLink 
            to="/waiting-room" 
            className={({ isActive }) => `px-2 py-1.5 text-[10.5px] font-extrabold flex flex-col items-center gap-0.5 rounded transition ${
              isActive ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Patients TV</span>
          </NavLink>

          <NavLink 
            to="/doctor" 
            className={({ isActive }) => `px-2 py-1.5 text-[10.5px] font-extrabold flex flex-col items-center gap-0.5 rounded transition ${
              isActive ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Doctor desk</span>
          </NavLink>

          <NavLink 
            to="/track" 
            className={({ isActive }) => `px-2 py-1.5 text-[10.5px] font-extrabold flex flex-col items-center gap-0.5 rounded transition ${
              isActive ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Tracker</span>
          </NavLink>
        </div>

      </div>
    </header>
  );
};

const RootWorkspace: React.FC = () => {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Routes>
        {/* Tab route paths mappings */}
        <Route path="/" element={<ReceptionistDashboard />} />
        <Route path="/waiting-room" element={<PatientWaitingRoom />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/track" element={<PatientTracker />} />
        <Route path="/track/:id" element={<PatientTracker />} />
        {/* Fallback route */}
        <Route path="*" element={<ReceptionistDashboard />} />
      </Routes>
    </main>
  );
};

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
          <NavigationHeader />
          <RootWorkspace />
        </div>
      </BrowserRouter>
    </SocketProvider>
  );
}
