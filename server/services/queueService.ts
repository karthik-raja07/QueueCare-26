import { Patient, Doctor, Consultation, QueueStats } from '../../src/types';
import { PatientRepository } from '../repositories/patientRepository';

const repo = new PatientRepository();

const PRIORITY_SCORES = {
  Emergency: 1000,
  Pregnant: 400,
  SeniorCitizen: 200,
  Normal: 0,
};

const AGING_FACTOR_PER_MINUTE = 12; // Avoids starvation by adding points over time
const DEFAULT_CONSULT_MINUTES = 10;

export class QueueService {
  private tokenCounter = 100; // Starts at 100, so first patient is 101

  private calculatePriorityScore(patient: Patient, now: Date): number {
    const base = PRIORITY_SCORES[patient.priority] || 0;
    const arrival = new Date(patient.createdAt);
    const waitTimeMinutes = Math.max(0, (now.getTime() - arrival.getTime()) / 60000);
    return base + (waitTimeMinutes * AGING_FACTOR_PER_MINUTE);
  }

  // Sort patients who are waiting or recalled in their optimal priority order
  private getSortedQueue(patients: Patient[], doctorId?: string): Patient[] {
    const now = new Date();
    let queue = patients.filter(p => p.status === 'waiting' || p.status === 'recalled');
    
    if (doctorId) {
      queue = queue.filter(p => p.doctorId === doctorId);
    }

    return queue.sort((a, b) => {
      // Recalled patients get a slight operational priority boost, but overall we use priority score
      const scoreA = this.calculatePriorityScore(a, now) + (a.status === 'recalled' ? 200 : 0);
      const scoreB = this.calculatePriorityScore(b, now) + (b.status === 'recalled' ? 200 : 0);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending by priority score
      }
      // Balance order of arrival if scores are equal
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async getDoctors(): Promise<Doctor[]> {
    return repo.getDoctors();
  }

  async getPatients(search?: string, doctorId?: string, status?: string): Promise<Patient[]> {
    let list = await repo.getPatients();
    
    if (doctorId) {
      list = list.filter(p => p.doctorId === doctorId);
    }
    
    if (status) {
      list = list.filter(p => p.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.phone.includes(q) || 
        p.tokenNumber.toString().includes(q)
      );
    }

    return list;
  }

  async getPatientById(id: string): Promise<Patient | null> {
    return repo.getPatientById(id);
  }

  // Calculate moving average consultation duration
  async getMovingAverageDuration(): Promise<number> {
    const consultations = await repo.getConsultations();
    const completed = consultations.filter(c => c.endTime !== null && c.durationMinutes !== null);
    if (completed.length === 0) {
      return DEFAULT_CONSULT_MINUTES;
    }
    // Take average of up to last 15 completed consultations
    const lastCompleted = completed.slice(-15);
    const total = lastCompleted.reduce((sum, c) => sum + (c.durationMinutes || 0), 0);
    return Math.max(1, Math.round(total / lastCompleted.length));
  }

  // Pre-calculate queue timing predictions for all waiting patients
  async getEstimatedWaitTimes(doctorId?: string): Promise<{ [patientId: string]: { tokensAhead: number; estWaitMinutes: number } }> {
    const patients = await repo.getPatients();
    const sorted = this.getSortedQueue(patients, doctorId);
    const avgDuration = await this.getMovingAverageDuration();

    const resultMap: { [patientId: string]: { tokensAhead: number; estWaitMinutes: number } } = {};
    sorted.forEach((patient, idx) => {
      resultMap[patient.id] = {
        tokensAhead: idx,
        estWaitMinutes: idx * avgDuration,
      };
    });

    return resultMap;
  }

  async addPatient(data: { name: string; age: number; phone: string; priority: Patient['priority']; doctorId: string }): Promise<Patient> {
    const allPatients = await repo.getPatients();
    const maxToken = allPatients.reduce((max, p) => p.tokenNumber > max ? p.tokenNumber : max, 100);
    this.tokenCounter = maxToken + 1;
    
    const now = new Date().toISOString();
    
    const newPatient: Patient = {
      id: `p-${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      age: Number(data.age),
      phone: data.phone,
      tokenNumber: this.tokenCounter,
      priority: data.priority,
      doctorId: data.doctorId,
      status: 'waiting',
      createdAt: now,
    };

    return repo.addPatient(newPatient);
  }

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    return repo.updatePatient(id, updates);
  }

  async deletePatient(id: string): Promise<boolean> {
    return repo.deletePatient(id);
  }

  // Call Next Token for a specific doctor
  async callNextToken(doctorId: string): Promise<Patient | null> {
    const allPatients = await repo.getPatients();
    
    // Check if there is already an active patient in progress for this doctor
    const currentActive = allPatients.find(p => p.doctorId === doctorId && p.status === 'inProgress');
    if (currentActive) {
      // Complete previous patient automatically to prevent multiple active consultations
      await this.completeConsultation(currentActive.id);
    }

    const sortedWaiting = this.getSortedQueue(allPatients, doctorId);
    if (sortedWaiting.length === 0) {
      return null;
    }

    const nextPatient = sortedWaiting[0];
    const now = new Date().toISOString();
    
    const updated = await repo.updatePatient(nextPatient.id, {
      status: 'inProgress',
      calledAt: now,
    });

    if (updated) {
      // Add consultation record
      await repo.addConsultation({
        id: `c-${Math.random().toString(36).substr(2, 9)}`,
        patientId: updated.id,
        doctorId: updated.doctorId,
        startTime: now,
        endTime: null,
        durationMinutes: null,
      });
    }

    return updated;
  }

  async skipToken(id: string): Promise<Patient | null> {
    return repo.updatePatient(id, { status: 'skipped' });
  }

  async cancelToken(id: string): Promise<Patient | null> {
    return repo.updatePatient(id, { status: 'cancelled' });
  }

  async recallToken(id: string): Promise<Patient | null> {
    // If patient is recalled, they should return to waiting state with flag/recalled status
    return repo.updatePatient(id, { status: 'recalled', calledAt: null });
  }

  async moveTokenToEnd(id: string): Promise<Patient | null> {
    const patient = await repo.getPatientById(id);
    if (!patient) return null;

    // Move token to end by adjusting their createdAt time to current timestamp (re-routing arrival order)
    return repo.updatePatient(id, {
      createdAt: new Date().toISOString(),
      status: 'waiting',
      calledAt: null
    });
  }

  async completeConsultation(patientId: string): Promise<Patient | null> {
    const patient = await repo.getPatientById(patientId);
    if (!patient || patient.status !== 'inProgress') return null;

    const now = new Date();
    const nowIso = now.toISOString();
    const startTimeStr = patient.calledAt || patient.createdAt;
    const startTime = new Date(startTimeStr);
    
    // Track duration in minutes (round to nearest integer, minimum 1 minute)
    const durationMs = now.getTime() - startTime.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

    // Update consultation
    await repo.updateConsultation(patient.id, patient.doctorId, durationMinutes, nowIso);

    // Update patient status
    return repo.updatePatient(patientId, {
      status: 'completed',
      completedAt: nowIso,
    });
  }

  // Detailed Analytics and Chart Data Generator
  async getQueueStats(): Promise<QueueStats> {
    const patients = await repo.getPatients();
    const consultations = await repo.getConsultations();
    const doctorsList = await repo.getDoctors();
    const avgDuration = await this.getMovingAverageDuration();

    const waiting = patients.filter(p => p.status === 'waiting' || p.status === 'recalled');
    const completed = patients.filter(p => p.status === 'completed');
    const inProgress = patients.find(p => p.status === 'inProgress');

    // Calculate longest wait (createdAt to calledAt)
    let longestWait = 0;
    patients.forEach(p => {
      if (p.calledAt) {
        const waitTime = (new Date(p.calledAt).getTime() - new Date(p.createdAt).getTime()) / 60000;
        if (waitTime > longestWait) {
          longestWait = Math.round(waitTime);
        }
      }
    });

    // Peak hours (group completed/called patients by hour)
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = (8 + i) % 24; // 8:00 AM to 7:00 PM
      const formatted = `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
      return { hour: formatted, rawHour: h, count: 0 };
    });

    patients.forEach(p => {
      const date = new Date(p.createdAt);
      const h = date.getHours();
      const bucket = hours.find(hBucket => hBucket.rawHour === h);
      if (bucket) {
        bucket.count++;
      }
    });

    // Patients by Priority
    const priorityCounts = { Emergency: 0, Pregnant: 0, SeniorCitizen: 0, Normal: 0 };
    patients.forEach(p => {
      if (p.priority in priorityCounts) {
        priorityCounts[p.priority]++;
      }
    });

    const patientsByPriority = Object.keys(priorityCounts).map(key => ({
      name: key === 'SeniorCitizen' ? 'Senior' : key === 'Pregnant' ? 'Pregnant' : key,
      value: priorityCounts[key as keyof typeof priorityCounts],
    }));

    // Queue Performance metrics by priority level
    const priorityGroupedWaitTimes: { [key: string]: { total: number; count: number } } = {
      Emergency: { total: 0, count: 0 },
      Pregnant: { total: 0, count: 0 },
      SeniorCitizen: { total: 0, count: 0 },
      Normal: { total: 0, count: 0 },
    };

    patients.forEach(p => {
      if (p.calledAt) {
        const waitTime = (new Date(p.calledAt).getTime() - new Date(p.createdAt).getTime()) / 60000;
        if (priorityGroupedWaitTimes[p.priority]) {
          priorityGroupedWaitTimes[p.priority].total += waitTime;
          priorityGroupedWaitTimes[p.priority].count++;
        }
      }
    });

    const queuePerformanceMetrics = Object.keys(priorityGroupedWaitTimes).map(key => {
      const stats = priorityGroupedWaitTimes[key];
      return {
        name: key === 'SeniorCitizen' ? 'Senior' : key === 'Pregnant' ? 'Pregnant' : key,
        avgWaitTime: stats.count > 0 ? Math.round(stats.total / stats.count) : 0,
        count: stats.count,
      };
    });

    // Doctor utilization rate
    const doctorUtilization: { [doctorId: string]: number } = {};
    doctorsList.forEach(doc => {
      // Percentage of consultations completed out of total consultations
      const docConsults = consultations.filter(c => c.doctorId === doc.id);
      const totalDocConsults = consultations.length;
      doctorUtilization[doc.id] = totalDocConsults > 0 ? Math.round((docConsults.length / totalDocConsults) * 100) : 0;
    });

    return {
      totalWaiting: waiting.length,
      activeToken: inProgress ? `Token ${inProgress.tokenNumber}` : 'None',
      avgConsultationTime: avgDuration,
      longestWaitTimeBeforeCall: longestWait,
      doctorUtilization,
      patientsServedToday: completed.length,
      patientsServedPerHour: hours.map(h => ({ hour: h.hour, count: h.count })),
      patientsByPriority,
      queuePerformanceMetrics,
    };
  }
}
