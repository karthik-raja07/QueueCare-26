export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  tokenNumber: number;
  priority: 'Normal' | 'SeniorCitizen' | 'Pregnant' | 'Emergency';
  doctorId: string;
  status: 'waiting' | 'inProgress' | 'completed' | 'skipped' | 'cancelled' | 'recalled';
  createdAt: string; // ISO String
  calledAt?: string | null; // ISO String
  completedAt?: string | null; // ISO String
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  roomNumber: string;
  isActive: boolean;
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  startTime: string; // ISO String
  endTime: string | null; // ISO String
  durationMinutes: number | null;
}

export interface QueueState {
  patients: Patient[];
  doctors: Doctor[];
  consultations: Consultation[];
  movingAverageDuration: number; // in minutes
}

export interface QueueStats {
  totalWaiting: number;
  activeToken: string | null;
  avgConsultationTime: number;
  longestWaitTimeBeforeCall: number;
  doctorUtilization: { [doctorId: string]: number }; // percentage of completed consultations per doctor
  patientsServedToday: number;
  patientsServedPerHour: { hour: string; count: number }[];
  patientsByPriority: { name: string; value: number }[];
  queuePerformanceMetrics: { name: string; avgWaitTime: number; count: number }[];
}
