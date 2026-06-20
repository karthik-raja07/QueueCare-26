import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Doctor, Patient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, Loader2, CheckCircle2, AlertTriangle, XCircle, RotateCcw, 
  Tv, Eye, Moon, Sun, Smartphone, User, ShieldAlert, Check
} from 'lucide-react';

interface TimelineItemProps {
  patient: Patient;
  doctorName?: string;
  roomName?: string;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ patient, doctorName, roomName }) => {
  // Let the status map handle icons and animation profiles
  const statusConfig = {
    waiting: {
      color: 'bg-white hover:bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200',
      icon: <Clock className="w-4 h-4 text-slate-400" />,
      text: 'Standby Queue',
      animateClass: '',
    },
    inProgress: {
      color: 'bg-indigo-50/70 hover:bg-indigo-50 border-indigo-200 text-indigo-700',
      icon: <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />,
      text: 'In Consultation',
      animateClass: 'ring-4 ring-indigo-550/10 shadow-lg shadow-indigo-100/50',
    },
    completed: {
      color: 'bg-emerald-50/45 hover:bg-emerald-50 border-emerald-100 text-emerald-600',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      text: 'Finished',
      animateClass: 'opacity-70',
    },
    skipped: {
      color: 'bg-amber-50/60 hover:bg-amber-50 border-amber-200 text-amber-700',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      text: 'No-Show / Skipped',
      animateClass: 'opacity-85',
    },
    cancelled: {
      color: 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 opacity-60',
      icon: <XCircle className="w-4 h-4 text-slate-400" />,
      text: 'Cancelled',
      animateClass: '',
    },
    recalled: {
      color: 'bg-purple-50/80 hover:bg-purple-100/60 border-purple-200 text-purple-700',
      icon: <RotateCcw className="w-4 h-4 text-purple-600" />,
      text: 'Doctor Recalled',
      animateClass: 'ring-4 ring-purple-100 active:scale-[1.01]',
    },
  };

  const config = statusConfig[patient.status] || statusConfig.waiting;

  // Custom animation variants via motion/react
  const rowVariants = {
    initial: { scale: 0.95, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 220, damping: 22 }
    },
    exit: { scale: 0.95, opacity: 0 },
    shake: {
      x: [0, -6, 6, -6, 6, 0],
      transition: { duration: 0.5 }
    }
  };

  const isRecalled = patient.status === 'recalled';

  return (
    <motion.div
      variants={rowVariants}
      initial="initial"
      animate={isRecalled ? ["animate", "shake"] : "animate"}
      exit="exit"
      layoutId={`card-${patient.id}`}
      className={`border rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs transition-all duration-300 ${config.color} ${config.animateClass}`}
    >
      <div className="flex items-center gap-4">
        {/* Token Number Card */}
        <div className="flex flex-col items-center justify-center bg-slate-900 text-white p-2.5 rounded-xl font-mono min-w-[76px] text-center shadow-md shadow-slate-950/20">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Code</span>
          <span className="text-xl font-black">{patient.tokenNumber}</span>
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-black text-slate-850 tracking-tight">{patient.name}</h4>
            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider ${
              patient.priority === 'Emergency' ? 'bg-red-500 text-white animate-pulse' :
              patient.priority === 'Pregnant' ? 'bg-pink-100 text-pink-700' :
              patient.priority === 'SeniorCitizen' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {patient.priority === 'SeniorCitizen' ? 'Senior' : patient.priority}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {doctorName ? (
              <span>Assigned: <strong className="text-slate-700">{doctorName}</strong> • <span className="font-mono text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded text-[10px]">{roomName}</span></span>
            ) : (
              <span className="italic text-slate-400">Waiting for physician assignment</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs font-bold text-slate-700">{config.text}</span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
            {patient.calledAt ? `Called: ${new Date(patient.calledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : `Arr: ${new Date(patient.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
          </span>
        </div>
        
        {/* Icon representation with popping scaling state */}
        <motion.div 
          initial={{ scale: 0.6 }} 
          animate={{ scale: 1 }} 
          transition={{ duration: 0.3 }}
          className="p-2.5 bg-white rounded-xl border border-slate-150 shadow-xs flex items-center justify-center"
        >
          {config.icon}
        </motion.div>
      </div>
    </motion.div>
  );
};

export const PatientWaitingRoom: React.FC = () => {
  const { patients, stats, triggerRefresh } = useSocket();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);

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

  // Filter current active/inprogress patient highlights
  const activePatients = patients.filter(p => p.status === 'inProgress');
  const waitingPatientsList = patients.filter(
    p => p.status === 'waiting' || p.status === 'recalled'
  ).sort((a, b) => {
    // Standard sorting for queue progression view
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const finishedPatients = patients.filter(
    p => p.status === 'completed' || p.status === 'skipped' || p.status === 'cancelled'
  ).slice(-6); // Only show the last few historical outcomes

  const activeDocPatient = (docId: string) => {
    return patients.find(p => p.doctorId === docId && p.status === 'inProgress');
  };

  return (
    <div className={`min-h-screen rounded-2xl transition-colors duration-300 p-6 ${
      isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-50 text-slate-800'
    } ${isTvMode ? 'p-10 border-4 border-indigo-500' : ''}`}>
      
      {/* Top Banner Toolbar */}
      <div id="patient-waiting-top-bar" className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 pb-5 border-b border-slate-200/60">
        <div>
          <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-500">Public Clinic Viewport</span>
          <h1 className={`font-black ${isTvMode ? 'text-3xl' : 'text-2xl'}`}>Patient Waiting Lounge</h1>
          <p className="text-xs text-slate-400">Live, auto-updating, queue tracker with vocal assistance</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme customizer */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg border transition ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
            title="Toggle eye-care dark mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Large Screen Mode Toggle */}
          <button
            onClick={() => setIsTvMode(!isTvMode)}
            className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-bold ${
              isTvMode ? 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            title="Simulate Large-Screen TV display"
          >
            <Tv className="w-4 h-4" />
            <span>{isTvMode ? 'Normal View' : 'Big TV Mode'}</span>
          </button>
        </div>
      </div>

      {/* Main Boards Section */}
      <div className={`grid grid-cols-1 ${isTvMode ? 'lg:grid-cols-12' : 'lg:grid-cols-12'} gap-8`}>
        
        {/* LEFT CARD: Current active calls per doctor */}
        <div className={`${isTvMode ? 'lg:col-span-4' : 'lg:col-span-4'} flex flex-col gap-6`}>
          <div className={`p-5 rounded-xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          } shadow-md`}>
            <h2 className="text-sm font-extrabold text-indigo-500 uppercase tracking-wider mb-4">Attending Physicians</h2>
            
            <div className="flex flex-col gap-4">
              {doctors.map(d => {
                const active = activeDocPatient(d.id);
                return (
                  <div 
                    key={d.id} 
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      active 
                        ? 'bg-blue-600 border-blue-600 shadow-sm text-white scale-[1.02]' 
                        : (isDarkMode ? 'bg-slate-850/50 border-slate-800' : 'bg-slate-50 border-slate-100')
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={`font-extrabold ${active ? 'text-white' : 'text-slate-800 dark:text-slate-100'} text-xs`}>{d.name}</h3>
                        <p className={`text-[10px] uppercase font-mono ${active ? 'text-blue-100' : 'text-slate-400'}`}>{d.specialization}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] font-mono ${
                        active ? 'bg-white text-blue-700' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')
                      }`}>
                        {d.roomNumber}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-white/20">
                      {active ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-blue-100 uppercase font-black tracking-widest flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                            NOW IN CONSULTATION
                          </span>
                          <span className="text-xl font-black bg-white rounded-md text-blue-700 px-3 py-1 font-mono shadow-xs">
                            Token {active.tokenNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest italic flex items-center gap-1">
                          Room Standby
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Statistics Summary */}
          <div className={`p-6 rounded-2xl border ${
            isDarkMode ? 'bg-indigo-950/40 border-indigo-900/60 text-indigo-100' : 'bg-indigo-50/70 border-indigo-100 text-indigo-900'
          } shadow-md`}>
            <h3 className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 text-indigo-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
              Wait Time Predictor
            </h3>
            <p className="text-[11px] leading-relaxed mb-4 text-indigo-950">
              Estimated wait times recalculate continuously using a moving average of recent medical sessions.
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-indigo-200/40 pt-4 mt-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Average Visit</span>
                <span className="text-xl font-black text-indigo-800 block font-mono mt-0.5">{stats?.avgConsultationTime ?? 10} min</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Longest Delay</span>
                <span className="text-xl font-black text-indigo-800 block font-mono mt-0.5">{stats?.longestWaitTimeBeforeCall ?? 0} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT BOARD: Waiting / Progression list */}
        <div className={`${isTvMode ? 'lg:col-span-8' : 'lg:col-span-8'} flex flex-col gap-6`}>
          
          {/* Active Call Highlight (Big) */}
          {activePatients.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 border border-indigo-700 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-indigo-200 tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"></span>
                  Active Consultation Signal
                </span>
                <h3 className="text-lg font-extrabold mt-1 tracking-tight">Your token is called! Head straight to your room.</h3>
              </div>

              <div className="flex gap-3">
                {activePatients.slice(-2).map(ap => {
                  const doc = doctors.find(d => d.id === ap.doctorId);
                  return (
                    <div key={ap.id} className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl flex items-center gap-3 hover:bg-white/15 transition duration-200">
                      <div className="font-mono bg-white text-indigo-700 font-extrabold px-3 py-2 rounded-lg text-2xl shadow-xs">
                        {ap.tokenNumber}
                      </div>
                      <div className="text-left font-sans">
                        <p className="text-xs font-black truncate max-w-[124px] leading-tight">{ap.name}</p>
                        <p className="text-[10px] text-indigo-200 font-bold uppercase mt-0.5 tracking-wider">{doc?.roomNumber ?? 'Standby'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waiting List Timeline */}
          <div className={`p-6 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'
          } shadow-xl shadow-slate-100/50`}>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/40 mb-5">
              <h3 className="font-extrabold uppercase tracking-widest text-xs text-slate-400">Progression List</h3>
              <span className="text-xs bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-xl text-indigo-600 font-extrabold shadow-3xs">
                {waitingPatientsList.length} waiting
              </span>
            </div>

            {/* Timelines container */}
            <div className="flex flex-col gap-3 min-h-[300px]">
              <AnimatePresence mode="popLayout">
                {waitingPatientsList.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center p-14 text-center"
                  >
                    <Check className="w-10 h-10 text-green-500 bg-green-50 border border-green-200 rounded-full p-2 mb-3 shadow" />
                    <p className="text-sm font-bold text-slate-500">Wait list is entirely clear.</p>
                    <p className="text-xs text-slate-400 mt-1">Excellent operations! All registered patients served.</p>
                  </motion.div>
                ) : (
                  waitingPatientsList.map(item => {
                    const doc = doctors.find(d => d.id === item.doctorId);
                    return (
                      <TimelineItem 
                        key={item.id} 
                        patient={item} 
                        doctorName={doc?.name}
                        roomName={doc?.roomNumber}
                      />
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Recent History log */}
          {finishedPatients.length > 0 && (
            <div className={`p-5 rounded-xl border ${
              isDarkMode ? 'bg-slate-950/20 border-slate-850' : 'bg-slate-100/40 border-slate-200/50'
            }`}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recently Completed / Logged</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {finishedPatients.map(fp => (
                  <div key={fp.id} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-2.5 rounded-lg flex items-center justify-between shadow-3xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                        {fp.tokenNumber}
                      </span>
                      <span className="text-xs truncate font-bold text-slate-550 max-w-[80px]">{fp.name}</span>
                    </div>
                    {fp.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {fp.status === 'skipped' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                    {fp.status === 'cancelled' && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
