import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Patient, Doctor } from '../types';
import { 
  UserPlus, Search, Filter, AlertCircle, Plus, Edit, Trash2, 
  ChevronRight, SkipForward, HelpCircle, CornerDownRight, CheckCircle, RotateCcw, Phone, User
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const ReceptionistDashboard: React.FC = () => {
  const { patients, stats, predictions, triggerRefresh } = useSocket();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  // Search and Filter states
  const [search, setSearch] = useState('');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Register Form states
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState<Patient['priority']>('Normal');
  const [doctorId, setDoctorId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit Form Modals
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPriority, setEditPriority] = useState<Patient['priority']>('Normal');
  const [editDoctorId, setEditDoctorId] = useState('');

  // QR Code tracking modal
  const [trackingPatient, setTrackingPatient] = useState<Patient | null>(null);

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
            if (data.length > 0) {
              setDoctorId(data[0].id);
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

  // Post register patient
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim() || !age || !phone.trim() || !doctorId) {
      setErrorMessage('Please fill in all patient registration fields.');
      return;
    }

    if (phone.length < 8) {
      setErrorMessage('Please enter a valid phone number (at least 8 digits).');
      return;
    }

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, phone, priority, doctorId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to register patient');
      }

      setName('');
      setAge('');
      setPhone('');
      setPriority('Normal');
      setSuccessMessage('Patient registered successfully! Token allocated.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Perform queue actions
  const triggerQueueAction = async (endpoint: string, patientId?: string, extraParams: any = {}) => {
    try {
      const res = await fetch(`/api/queue/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, ...extraParams }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || `Operation ${endpoint} failed`);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Call doctor specific next token
  const handleCallNext = async (docId: string) => {
    try {
      const res = await fetch('/api/queue/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: docId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to call next token');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete patient
  const handleDeletePatient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this patient from the logs?')) return;
    try {
      const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch (err: any) {
      console.error(err);
    }
  };

  // Open Edit Dialog
  const openEditModal = (p: Patient) => {
    setEditingPatient(p);
    setEditName(p.name);
    setEditAge(p.age.toString());
    setEditPhone(p.phone);
    setEditPriority(p.priority);
    setEditDoctorId(p.doctorId);
  };

  // Submit Edit Patient update
  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    try {
      const res = await fetch(`/api/patients/${editingPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          age: Number(editAge),
          phone: editPhone,
          priority: editPriority,
          doctorId: editDoctorId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update patient');
      }

      setEditingPatient(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtering patients frontend
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.phone.includes(search) ||
                          p.tokenNumber.toString().includes(search);
    const matchesDoctor = selectedDoctorFilter ? p.doctorId === selectedDoctorFilter : true;
    const matchesPriority = selectedPriorityFilter ? p.priority === selectedPriorityFilter : true;
    const matchesStatus = selectedStatusFilter ? p.status === selectedStatusFilter : true;
    return matchesSearch && matchesDoctor && matchesPriority && matchesStatus;
  });

  return (
    <div id="receptionist-dashboard-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-screen">
      
      {/* LEFT: Registration & Stats */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Statistics Blocks */}
        <div id="receptionist-stats-hub" className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col items-center text-center hover:scale-[1.02] transition-transform duration-300">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waiting Queue</span>
            <span className="text-4xl font-extrabold text-indigo-600 mt-2 tracking-tight">{stats?.totalWaiting ?? 0}</span>
            <span className="text-[10px] text-slate-400 mt-1">patients waiting</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col items-center text-center hover:scale-[1.02] transition-transform duration-300">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Served Today</span>
            <span className="text-4xl font-extrabold text-emerald-600 mt-2 tracking-tight">{stats?.patientsServedToday ?? 0}</span>
            <span className="text-[10px] text-slate-400 mt-1">completed calls</span>
          </div>
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col items-center text-center col-span-2">
            <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-widest">Wait Prediction Engine</span>
            <span className="text-xs font-medium text-slate-300 mt-2 flex items-center gap-2">
              Avg. Duration: <strong className="text-indigo-400 text-lg font-mono">{stats?.avgConsultationTime ?? 10}m</strong> per ticket
            </span>
          </div>
        </div>

        {/* Patient Register Container */}
        <div id="patient-registration-panel" className="bg-white p-6 rounded-2xl border border-slate-150/80 shadow-xl shadow-slate-100/70">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 leading-tight">Patient Enrollment</h2>
              <p className="text-[10.5px] text-slate-400">Queue & Triage allocation</p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Patient Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Johnathan Doe"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-250"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">Age</label>
                <input 
                  type="number" 
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Years"
                  min="0"
                  max="120"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-250"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500">Triage Urgency</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Patient['priority'])}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-250"
                >
                  <option value="Normal">Normal Standard</option>
                  <option value="SeniorCitizen">Senior Citizen</option>
                  <option value="Pregnant">Pregnant Woman</option>
                  <option value="Emergency">🚨 EMERGENCY</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 555-0199"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-250"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">Attending Specialist</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-250"
                required
              >
                <option value="">-- Choose Doctor --</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialization}) - {d.roomNumber}
                  </option>
                ))}
              </select>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 flex-none" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs px-3 py-2.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 flex-none" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll Patient Token</span>
            </button>
          </form>
        </div>

        {/* Doctor Instant Operational Calling Unit */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3.5 flex items-center gap-1.5">
            <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
            <span>Doctor Direct Call Ticks</span>
          </h3>
          <div className="flex flex-col gap-3">
            {doctors.map(d => (
              <div key={d.id} className="bg-white p-3.5 rounded-xl border border-slate-150 flex items-center justify-between shadow-xs hover:border-slate-300 transition duration-200">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">{d.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider font-mono text-indigo-600">{d.roomNumber}</p>
                </div>
                <button
                  onClick={() => handleCallNext(d.id)}
                  className="px-3 py-1.5 text-xs bg-indigo-50 font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg transition cursor-pointer border border-indigo-100 hover:border-indigo-600"
                >
                  Call Next
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RIGHT: Live Queue Monitors */}
      <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl p-6 shadow-xl shadow-slate-100/50 flex flex-col">
        
        {/* Title Headers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Queue Watchlist</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage triage positions, statuses, priority overrides, and diagnostics</p>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href="/api/analytics/export/json" 
              className="text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs flex items-center gap-1 cursor-pointer"
              download
            >
              <span>Export JSON</span>
            </a>
            <a 
              href="/api/analytics/export/csv" 
              className="text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs flex items-center gap-1 cursor-pointer"
              download
            >
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-150">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full pl-9 pr-2 py-2 border border-slate-200 rounded-xl bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <select
              value={selectedDoctorFilter}
              onChange={(e) => setSelectedDoctorFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-white text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">By Doctor (All)</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-white text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">By Priority (All)</option>
              <option value="Emergency">🚨 Emergency</option>
              <option value="Pregnant">🤰 Pregnant</option>
              <option value="SeniorCitizen">👵 Senior Citizen</option>
              <option value="Normal">Normal</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl bg-white text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">By Status (All)</option>
              <option value="waiting">Waiting</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="cancelled">Cancelled</option>
              <option value="recalled">Recalled</option>
            </select>
          </div>
        </div>

        {/* Patients Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-xl">Token</th>
                <th className="py-3 px-3">Patient Info</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Physician</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Est. Wait</th>
                <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium italic">
                    No matching patients found in queue list.
                  </td>
                </tr>
              ) : (
                filteredPatients.map(p => {
                  const assignedDoc = doctors.find(d => d.id === p.doctorId);
                  const pred = predictions[p.id] || { tokensAhead: 0, estWaitMinutes: 0 };
                  
                  return (
                    <tr 
                      key={p.id} 
                      className={`border-b border-slate-100 hover:bg-slate-50/70 transition duration-150 ${
                        p.status === 'inProgress' ? 'bg-blue-50/40 font-semibold' : ''
                      }`}
                    >
                      {/* Token Code */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-base font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 shadow-2xs">
                          {p.tokenNumber}
                        </span>
                      </td>

                      {/* Patient metadata */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{p.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{p.age} yrs • {p.phone}</span>
                        </div>
                      </td>

                      {/* Priority Tag */}
                      <td className="py-3 px-3">
                        {p.priority === 'Emergency' && (
                          <span className="bg-red-100 border border-red-200 text-red-600 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide animate-pulse">
                            🚨 EMERGENCY
                          </span>
                        )}
                        {p.priority === 'Pregnant' && (
                          <span className="bg-pink-100 border border-pink-200 text-pink-600 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide">
                            🤰 Pregnant
                          </span>
                        )}
                        {p.priority === 'SeniorCitizen' && (
                          <span className="bg-amber-100 border border-amber-200 text-amber-600 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide">
                            👵 Senior
                          </span>
                        )}
                        {p.priority === 'Normal' && (
                          <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Doctor Assignment */}
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {assignedDoc ? (
                          <div className="flex flex-col">
                            <strong>{assignedDoc.name}</strong>
                            <span className="text-[10px] text-indigo-500 font-mono">{assignedDoc.roomNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status Tags */}
                      <td className="py-3 px-3 text-xs">
                        {p.status === 'waiting' && <span className="text-slate-400 bg-slate-100 px-2 py-0.5 border rounded-full font-bold">Waiting</span>}
                        {p.status === 'inProgress' && <span className="text-blue-600 bg-blue-100 px-2 py-0.5 border border-blue-300 rounded-full font-bold animate-pulse">Active</span>}
                        {p.status === 'completed' && <span className="text-green-600 bg-green-100 px-2 py-0.5 border border-green-300 rounded-full font-bold">Done</span>}
                        {p.status === 'skipped' && <span className="text-orange-500 bg-orange-100 px-2 py-0.5 border border-orange-200 rounded-full font-bold">Skipped</span>}
                        {p.status === 'cancelled' && <span className="text-red-500 bg-red-100 px-2 py-0.5 border border-red-200 rounded-full font-bold">Cancelled</span>}
                        {p.status === 'recalled' && <span className="text-purple-600 bg-purple-100 px-2 py-0.5 border border-purple-200 rounded-full font-bold">Recalled</span>}
                      </td>

                      {/* Est Wait Predictions */}
                      <td className="py-3 px-3 font-mono text-sm">
                        {p.status === 'waiting' || p.status === 'recalled' ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{pred.estWaitMinutes} mins</span>
                            <span className="text-[10px] text-slate-400">{pred.tokensAhead} card(s) ahead</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* Operational buttons */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-1.5 items-center">
                          
                          {/* QR Trigger */}
                          <button
                            onClick={() => setTrackingPatient(p)}
                            className="p-1 border text-slate-500 bg-white hover:bg-slate-50 rounded shadow-2xs hover:text-indigo-600 transition"
                            title="Generate Patient Tracker QR Code"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 11v1m0-6H9m3 0h3m-3-4a1 1 0 110-2 1 1 0 010 2zm0 11a1 1 0 110-2 1 1 0 010 2zm0-6a1 1 0 110-2 1 1 0 010 2zm7-5a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>

                          {/* Control functions if active/waiting */}
                          {(p.status === 'waiting' || p.status === 'recalled' || p.status === 'skipped') && (
                            <>
                              <button
                                onClick={() => triggerQueueAction('skip', p.id)}
                                className="p-1 border border-orange-200 text-orange-600 bg-white hover:bg-orange-50 rounded"
                                title="Mark Skipped"
                              >
                                <SkipForward className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => triggerQueueAction('cancel', p.id)}
                                className="p-1 border border-red-200 text-red-500 bg-white hover:bg-red-50 rounded"
                                title="Cancel Ticket"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {p.status === 'inProgress' && (
                            <button
                              onClick={() => triggerQueueAction('complete', p.id)}
                              className="px-2 py-1 text-xs font-bold border border-green-300 text-green-700 bg-green-50 hover:bg-green-600 hover:text-white rounded"
                              title="Complete consultation"
                            >
                              Complete
                            </button>
                          )}

                          {p.status === 'skipped' && (
                            <>
                              <button
                                onClick={() => triggerQueueAction('recall', p.id)}
                                className="p-1 border border-purple-200 text-purple-600 bg-white hover:bg-purple-100 rounded"
                                title="Recall patient (triggers Shake effect)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => triggerQueueAction('move-to-end', p.id)}
                                className="p-1 border text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-600 hover:text-white rounded"
                                title="Move to end of line"
                              >
                                <CornerDownRight className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Edit Details */}
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 border border-slate-200 text-slate-500 hover:text-indigo-600 bg-white rounded cursor-pointer"
                            title="Edit details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Entry */}
                          <button
                            onClick={() => handleDeletePatient(p.id)}
                            className="p-1 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer"
                            title="Purge record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ==========================================
          EDIT PATIENT MODAL
          ========================================== */}
      {editingPatient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-1.5 border-b pb-2">
              <Edit className="w-4 h-4 text-indigo-600" />
              <span>Modify Patient Details</span>
            </h3>

            <form onSubmit={handleUpdatePatient} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Patient Name</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border p-2 rounded text-sm bg-slate-50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Age</label>
                  <input 
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="w-full border p-2 rounded text-sm bg-slate-50"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500">Triage Status</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Patient['priority'])}
                    className="w-full border p-2 rounded text-sm bg-slate-50"
                  >
                    <option value="Normal">Normal</option>
                    <option value="SeniorCitizen">Senior Citizen</option>
                    <option value="Pregnant">Pregnant</option>
                    <option value="Emergency">EMERGENCY</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Phone</label>
                <input 
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border p-2 rounded text-sm bg-slate-50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Doctor</label>
                <select
                  value={editDoctorId}
                  onChange={(e) => setEditDoctorId(e.target.value)}
                  className="w-full border p-2 rounded text-sm bg-slate-50"
                  required
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-3 py-1.5 border rounded text-xs bg-white text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-bold rounded text-xs text-white shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          QR TRACKING GENERATOR MODAL
          ========================================== */}
      {trackingPatient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-sm w-full mx-4 shadow-xl flex flex-col items-center text-center">
            <h3 className="text-base font-bold text-slate-800 mb-1">Queue Tracking Board</h3>
            <p className="text-xs text-slate-400 mb-4">Patient: <strong>{trackingPatient.name}</strong> • Token {trackingPatient.tokenNumber}</p>
            
            <div className="p-4 bg-slate-100 rounded-lg mb-4 border border-slate-200">
              <QRCodeSVG 
                value={`${window.location.origin}/track/${trackingPatient.id}`} 
                size={180}
              />
            </div>

            <p className="text-xs text-indigo-600 font-semibold mb-2 bg-indigo-50 px-3 py-1 rounded border border-indigo-100 select-all truncate max-w-xs font-mono">
              {window.location.origin}/track/{trackingPatient.id}
            </p>
            <p className="text-[11px] text-slate-400 max-w-[280px] mb-4">
              Scan this QR with a mobile phone camera to open a live tracking viewport with instant estimated wait updates.
            </p>

            <button
              onClick={() => setTrackingPatient(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs cursor-pointer transition border border-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
