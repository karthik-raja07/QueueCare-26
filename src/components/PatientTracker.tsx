import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Doctor, Patient } from '../types';
import { 
  HeartHandshake, Clock, UserCheck, AlertTriangle, Play, CheckCircle2, 
  Smartphone, Activity, RefreshCw, LogIn, ChevronLeft
} from 'lucide-react';

interface PatientTrackerProps {
  patientIdParam?: string;
  onBackToDashboard?: () => void;
}

export const PatientTracker: React.FC<PatientTrackerProps> = ({ patientIdParam, onBackToDashboard }) => {
  const { patients, predictions } = useSocket();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientId, setPatientId] = useState<string | null>(patientIdParam || null);
  const [searchToken, setSearchToken] = useState('');
  const [searchError, setSearchError] = useState('');

  // Extract patientId from URL if not passed explicitly as prop
  useEffect(() => {
    if (!patientIdParam) {
      const match = window.location.pathname.match(/\/track\/([^/]+)/);
      if (match && match[1]) {
        setPatientId(match[1]);
      }
    } else {
      setPatientId(patientIdParam);
    }
  }, [patientIdParam, window.location.pathname]);

  // Fetch doctors on mount with retries
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

  const patient = patients.find(p => p.id === patientId);
  const doctor = patient ? doctors.find(d => d.id === patient.doctorId) : null;
  const pred = patient ? (predictions[patient.id] || { tokensAhead: 0, estWaitMinutes: 0 }) : { tokensAhead: 0, estWaitMinutes: 0 };

  const handleSearchToken = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!searchToken.trim()) return;

    // Search by Token Number
    const found = patients.find(p => p.tokenNumber.toString() === searchToken.trim() && p.status !== 'completed' && p.status !== 'cancelled');
    if (found) {
      setPatientId(found.id);
      setSearchToken('');
    } else {
      const finishedFound = patients.find(p => p.tokenNumber.toString() === searchToken.trim());
      if (finishedFound) {
        setPatientId(finishedFound.id);
        setSearchToken('');
      } else {
        setSearchError('Active token not found. Please review the number or ask reception.');
      }
    }
  };

  const getStatusDetail = (status: Patient['status']) => {
    switch (status) {
      case 'waiting':
        return {
          title: 'Waiting in Queue',
          desc: 'Your token is active in the triage queue. Please remain in the patient waiting room.',
          color: 'text-slate-650 bg-slate-100 border-slate-200',
          icon: <Clock className="w-6 h-6 text-slate-500" />
        };
      case 'inProgress':
        return {
          title: '🚨 Proceed to Consultation Room!',
          desc: 'Your token has been called! Please head immediately to your physician room.',
          color: 'text-blue-700 bg-blue-100 border-blue-400 animate-pulse',
          icon: <Play className="w-6 h-6 text-blue-600" />
        };
      case 'completed':
        return {
          title: 'Consultation Completed',
          desc: 'Your medical session is complete. Thank you for choosing QueueCare!',
          color: 'text-green-700 bg-green-100 border-green-300',
          icon: <CheckCircle2 className="w-6 h-6 text-green-600" />
        };
      case 'skipped':
        return {
          title: 'Token Skipped',
          desc: 'You were called but were not present. Please contact the front registration desk to recall your token.',
          color: 'text-amber-700 bg-amber-100 border-amber-300',
          icon: <AlertTriangle className="w-6 h-6 text-amber-500" />
        };
      case 'recalled':
        return {
          title: '🚨 Token Recalled',
          desc: 'Your physician is calling you back! Proceed immediately to the room.',
          color: 'text-purple-700 bg-purple-100 border-purple-400',
          icon: <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
        };
      case 'cancelled':
        return {
          title: 'Registration Voided',
          desc: 'This token assignment has been cancelled by the reception team.',
          color: 'text-red-700 bg-red-100 border-red-200',
          icon: <AlertTriangle className="w-6 h-6 text-red-500" />
        };
      default:
        return {
          title: 'Status Pending',
          desc: 'Awaiting coordination details.',
          color: 'text-slate-500 bg-slate-50 border-slate-200',
          icon: <Clock className="w-6 h-6" />
        };
    }
  };

  const currentStatus = patient ? getStatusDetail(patient.status) : null;

  return (
    <div id="patient-tracker-view" className="max-w-md mx-auto min-h-screen flex flex-col justify-between py-6 px-4 bg-slate-50">
      
      {/* Header Info */}
      <div className="flex flex-col gap-4">
        
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="self-start flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Dashboard Menu</span>
          </button>
        )}

        {/* Brand Banner */}
        <div className="flex items-center gap-2.5 bg-indigo-600 p-4 rounded-xl text-white shadow-md">
          <Smartphone className="w-6 h-6" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider">QueueCare Mobile Portal</h2>
            <p className="text-[10px] text-indigo-150">Continuous live synchronisation via Socket.IO</p>
          </div>
        </div>

        {/* If no patient is logged / tracked yet, render portal finder */}
        {!patient ? (
          <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-md mt-4">
            <h3 className="text-base font-extrabold text-slate-800">Track Your Token</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Enter your printed token code below to check real-time wait times on your personal phone.
            </p>

            <form onSubmit={handleSearchToken} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Token Number</label>
                <input 
                  type="number"
                  value={searchToken}
                  onChange={(e) => setSearchToken(e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full border p-2 rounded text-sm bg-slate-50 text-center font-bold font-mono focus:ring-indigo-500"
                  required
                />
              </div>

              {searchError && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  <span>{searchError}</span>
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 font-bold rounded text-xs text-white uppercase flex items-center justify-center gap-1 mt-1 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Synchronise Tracker</span>
              </button>
            </form>
          </div>
        ) : (
          /* Live tracker viewport */
          <div className="flex flex-col gap-5 mt-2">
            
            {/* Status Alert box */}
            <div className={`p-4 border rounded-xl flex items-start gap-3 shadow-xs ${currentStatus?.color}`}>
              <div className="p-2 bg-white rounded-full border shadow-2xs mt-0.5">
                {currentStatus?.icon}
              </div>
              <div className="text-left">
                <h3 className="font-extrabold text-sm">{currentStatus?.title}</h3>
                <p className="text-xs mt-1 leading-relaxed text-slate-705 bg-white/20 p-2 rounded">
                  {currentStatus?.desc}
                </p>
              </div>
            </div>

            {/* Token details card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Your Allocated Token</span>
                  <p className="text-2xl font-black text-slate-800 font-mono mt-0.5">{patient.tokenNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Patient Name</span>
                  <h4 className="text-sm font-bold text-slate-800 text-right mt-1">{patient.name}</h4>
                </div>
              </div>

              {/* Waiting status information */}
              {(patient.status === 'waiting' || patient.status === 'recalled') ? (
                <div className="grid grid-cols-2 gap-4 pt-4 text-center">
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Tokens Ahead</span>
                    <span className="text-2xl font-extrabold font-mono text-indigo-600 mt-1 block">{pred.tokensAhead}</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase font-sans">Estimated Delay</span>
                    <span className="text-2xl font-extrabold font-mono text-indigo-600 mt-1 block">{pred.estWaitMinutes}m</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-lg text-center mt-4">
                  <span className="text-xs font-bold text-slate-505 block">Current Position Standby</span>
                  <p className="text-xs text-slate-400 mt-0.5">Wait timers only apply to pending triage logs.</p>
                </div>
              )}
            </div>

            {/* Doctor assigned details */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Assigned Clinician</span>
              
              {doctor ? (
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">{doctor.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide font-mono">{doctor.specialization}</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-indigo-50 text-indigo-700 font-mono font-bold text-xs uppercase px-2.5 py-1 rounded-md border border-indigo-150">
                      {doctor.roomNumber}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-slate-400 mt-2">Connecting triage specialist shortly...</p>
              )}
            </div>

            {/* Step-by-step progress cards bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Operations Progression</span>
              
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">1</div>
                    <div className="w-0.5 h-10 bg-green-400"></div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Triage Registration</h5>
                    <p className="text-[10px] text-slate-400">Enrolled into clinic queues code system: {new Date(patient.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      (patient.status === 'inProgress' || patient.status === 'completed') ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white animate-pulse'
                    }`}>2</div>
                    <div className="w-0.5 h-10 bg-slate-200"></div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Triage Progression</h5>
                    {(patient.status === 'waiting' || patient.status === 'recalled') ? (
                      <p className="text-[10px] text-slate-400 animate-pulse">Position {pred.tokensAhead} card(s) ahead. Estimated {pred.estWaitMinutes} mins.</p>
                    ) : (
                      <p className="text-[10px] text-slate-500">Passed queue waiting thresholds</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      patient.status === 'completed' ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>3</div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-850">Medical Session & Checkout</h5>
                    <p className="text-[10px] text-slate-400">Completed consultations release details immediately.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Log out / track another button */}
            <button
              onClick={() => setPatientId(null)}
              className="w-full py-1.5 border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-500 font-bold transition text-xs cursor-pointer"
            >
              Track Another Token Code
            </button>

          </div>
        )}

      </div>

      {/* Footer credits */}
      <div className="text-center text-[10px] text-slate-400 flex flex-col gap-0.5">
        <p>Powered by QueueCare 26 AI Engines</p>
        <p>Synchronized via secure local websockets</p>
      </div>

    </div>
  );
};
