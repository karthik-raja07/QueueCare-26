import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { Doctor, Patient } from '../types';
import { 
  Users, CheckCircle2, Clock, BarChart4, ArrowUpRight, Award, Zap,
  Play, CheckSquare, RefreshCw, AlertCircle, TrendingUp, Sparkles, Building
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

const COLORS = ['#4f46e5', '#ec4899', '#f59e0b', '#64748b'];

export const DoctorDashboard: React.FC = () => {
  const { patients, stats, triggerRefresh } = useSocket();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeDoctorId, setActiveDoctorId] = useState<string>('');

  // Fetch doctors list on load with retries
  useEffect(() => {
    let active = true;
    const fetchWithRetry = async (retries = 5, delay = 2000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch('/api/doctors');
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const data = await res.json();
          if (active) {
            setDoctors(data);
            if (data.length > 0) {
              setActiveDoctorId(data[0].id);
            }
          }
          return;
        } catch (err) {
          console.warn(`Attempt ${i + 1} to fetch doctors failed:`, err);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      console.error('Error fetching doctors after maximum retries');
    };

    fetchWithRetry();
    return () => {
      active = false;
    };
  }, []);

  const currentDoctor = doctors.find(d => d.id === activeDoctorId);

  // Filter patients specifically for this doctor
  const docPatients = patients.filter(p => p.doctorId === activeDoctorId);
  const activeConsultation = docPatients.find(p => p.status === 'inProgress');
  const waitingCount = docPatients.filter(p => p.status === 'waiting' || p.status === 'recalled').length;
  const servedTodayCount = docPatients.filter(p => p.status === 'completed').length;

  // Custom operation trigger utilities
  const handleCallNext = async () => {
    if (!activeDoctorId) return;
    try {
      const res = await fetch('/api/queue/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: activeDoctorId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to call next token');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleComplete = async () => {
    if (!activeConsultation) return;
    try {
      const res = await fetch('/api/queue/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: activeConsultation.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSkip = async (id: string) => {
    try {
      await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: id }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecall = async (id: string) => {
    try {
      await fetch('/api/queue/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: id }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Timezone-aware client-side hourly served / registered patient load
  const hourlyServedData = useMemo(() => {
    const currentHour = new Date().getHours();
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = (currentHour - 11 + i + 24) % 24;
      const formatted = `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
      return { hour: formatted, rawHour: h, count: 0 };
    });

    patients.forEach(p => {
      if (!p.createdAt) return;
      const date = new Date(p.createdAt);
      const h = date.getHours();
      const bucket = hours.find(hBucket => hBucket.rawHour === h);
      if (bucket) {
        bucket.count++;
      }
    });

    return hours.map(h => ({ hour: h.hour, count: h.count }));
  }, [patients]);
  const priorityDistribution = stats?.patientsByPriority || [];
  const performanceMetrics = stats?.queuePerformanceMetrics || [];
  const doctorUtilizationPercent = currentDoctor && stats?.doctorUtilization 
    ? (stats.doctorUtilization[currentDoctor.id] || 0) 
    : 0;

  return (
    <div id="doctor-dashboard-view" className="flex flex-col gap-6 min-h-screen font-sans">
      
      {/* Top Selector Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl shadow-slate-100/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <Building className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Practitioner Desk Console</h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage medical logs, call tokens, stream consultations, and track KPIs</p>
          </div>
        </div>

        {/* Doctor simulated switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Current Doctor Access:</span>
          <select
            value={activeDoctorId}
            onChange={(e) => setActiveDoctorId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:bg-white transition"
          >
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.specialization})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Core treatment controller */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Active Call station */}
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-850 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col justify-between min-h-[320px]">
            <div>
              <span className="bg-indigo-500/40 text-indigo-100 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-400/20">
                Active Treatment Station
              </span>

              {activeConsultation ? (
                <div className="mt-6">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-3xl font-black bg-white text-indigo-700 px-4 py-2 rounded-2xl shadow-lg shadow-indigo-950/40">
                      {activeConsultation.tokenNumber}
                    </span>
                    <div>
                      <h3 className="text-lg font-black tracking-tight">{activeConsultation.name}</h3>
                      <p className="text-xs text-indigo-200">Age: {activeConsultation.age} • Phone: {activeConsultation.phone}</p>
                    </div>
                  </div>

                  <p className="text-xs text-indigo-100/80 mt-5 leading-relaxed bg-indigo-950/40 border border-indigo-500/20 p-3.5 rounded-xl">
                    Current patient is called and active in <strong className="text-white">{currentDoctor?.roomNumber}</strong>. Please complete the consultation before calling next token.
                  </p>
                </div>
              ) : (
                <div className="mt-8">
                  <h3 className="text-lg font-extrabold tracking-tight">Treatment Desk Vacant</h3>
                  <p className="text-xs text-indigo-200 mt-2 leading-relaxed">
                    No active ticket. Invite the highest-priority patient in the wait queue to commence care.
                  </p>
                </div>
              )}
            </div>

            {/* Treatment controls */}
            <div className="mt-6 flex flex-col gap-2.5">
              {activeConsultation ? (
                <button
                  onClick={handleComplete}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold rounded-xl text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20 transition duration-150 uppercase"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Complete consultation</span>
                </button>
              ) : (
                <button
                  onClick={handleCallNext}
                  disabled={waitingCount === 0}
                  className={`w-full py-3 font-extrabold rounded-xl text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer transition duration-150 uppercase ${
                    waitingCount === 0 
                      ? 'bg-slate-850/50 text-slate-500 border border-slate-800' 
                      : 'bg-white hover:bg-slate-50 text-indigo-750 shadow-lg shadow-indigo-950/20'
                  }`}
                >
                  <Play className="w-4 h-4 fill-indigo-750" />
                  <span>Call Next Token ({waitingCount})</span>
                </button>
              )}

              {activeConsultation && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSkip(activeConsultation.id)}
                    className="py-2 border border-white/20 hover:bg-white/10 rounded-xl text-xs font-semibold text-white transition cursor-pointer"
                  >
                    Skip Token
                  </button>
                  <button
                    onClick={() => handleRecall(activeConsultation.id)}
                    className="py-2 border border-white/20 hover:bg-white/10 rounded-xl text-xs font-semibold text-white transition cursor-pointer"
                  >
                    Recall Ticket
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Practitioner Statistics scorecard */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xl shadow-slate-100/50 flex flex-col gap-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Office Performance Logs</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Assigned Waiting</span>
                <span className="text-xl font-bold font-mono text-indigo-600 mt-1 block">{waitingCount}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Served by Doc</span>
                <span className="text-xl font-bold font-mono text-green-600 mt-1 block">{servedTodayCount}</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 col-span-2">
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Office Utilisation Rate</span>
                <span className="text-xl font-bold font-mono text-indigo-650 mt-1 block">{doctorUtilizationPercent}%</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Avg Consultation</span>
                <span className="text-xl font-bold font-mono text-indigo-650 mt-1 block">{stats?.avgConsultationTime ?? 10}m</span>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT: High quality charts & analytics */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Quick Metrics highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 border border-slate-150 rounded-2xl flex items-center justify-between shadow-xl shadow-slate-100/40">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Consulted</span>
                <h4 className="text-2xl font-black text-slate-800 mt-1 tracking-tight">{stats?.patientsServedToday ?? 0}</h4>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-150 rounded-2xl flex items-center justify-between shadow-xl shadow-slate-100/40">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Standby</span>
                <h4 className="text-2xl font-black text-slate-800 mt-1 tracking-tight">{stats?.totalWaiting ?? 0}</h4>
              </div>
              <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-150 rounded-2xl flex items-center justify-between shadow-xl shadow-slate-100/40">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average Session</span>
                <h4 className="text-2xl font-black text-slate-800 mt-1 tracking-tight">{stats?.avgConsultationTime ?? 10}m</h4>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Analytics Visualizers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Chart A: Patients registration / calls per hour */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xl shadow-slate-100/40">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1.5 border-b pb-3">
                <BarChart4 className="w-4 h-4 text-indigo-500" />
                <span>In-Patient Load Trend (Hourly)</span>
              </h3>

              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyServedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} />
                    <YAxis stroke="#94a3b8" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#ffffff', borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 11, fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" name="Patients Enrolled" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Performance Metrics (Average wait per Priority level) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xl shadow-slate-100/40">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1.5 border-b pb-3">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span>Average Wait Time by Priority (Minutes)</span>
              </h3>

              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceMetrics} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                    <YAxis stroke="#94a3b8" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#ffffff', borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 11, fontWeight: 'bold' }} />
                    <Bar dataKey="avgWaitTime" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Avg Wait (Minutes)">
                      {performanceMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Emergency' ? '#ef4444' : '#4f46e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart C: Triage/Priority Group splits */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl shadow-slate-100/40 col-span-1 md:col-span-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Triage Composition & Priority Splitting</span>
                </h3>
                <span className="text-[10px] text-slate-400 block mt-1 sm:mt-0 font-bold uppercase tracking-wide">Emergency vs Normal proportion</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-5 h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityDistribution.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {priorityDistribution.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="md:col-span-7 flex flex-wrap gap-2 text-xs font-bold justify-center md:justify-start">
                  {priorityDistribution.map((entry, idx) => (
                    <div key={entry.name} className="flex items-center gap-2 border border-slate-150 bg-slate-50 p-2.5 rounded-xl">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="text-slate-500 font-bold text-[11px]">{entry.name}:</span>
                      <span className="font-mono text-indigo-600 text-sm font-black">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
