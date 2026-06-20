import { Patient, Doctor, Consultation } from '../../src/types';
import { getMongoDb } from '../lib/mongodb';

// ==========================================
// IN-MEMORY STORAGE LAYOUT (FALLBACK STORE)
// ==========================================
// Used only if MONGODB_URI is not set or database connection fails
const fallbackPatients: Patient[] = [];
const fallbackConsultations: Consultation[] = [];

// Seed system doctors
const doctors: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Avery Johnson',
    specialization: 'Cardiology',
    roomNumber: 'Room 101',
    isActive: true,
  },
  {
    id: 'doc-2',
    name: 'Dr. Sarah Patel',
    specialization: 'Pediatrics',
    roomNumber: 'Room 102',
    isActive: true,
  },
  {
    id: 'doc-3',
    name: 'Dr. Marcus Vance',
    specialization: 'General Medicine',
    roomNumber: 'Room 103',
    isActive: true,
  },
  {
    id: 'doc-4',
    name: 'Dr. Emily Chen',
    specialization: 'Obstetrics & Gynecology',
    roomNumber: 'Room 104',
    isActive: true,
  }
];

export class PatientRepository {
  async getPatients(): Promise<Patient[]> {
    const db = await getMongoDb();
    if (db) {
      try {
        return await db.collection<Patient>('patients')
          .find({}, { projection: { _id: 0 } })
          .toArray();
      } catch (err) {
        console.error('Failed to get patients from MongoDB, using fallback:', err);
      }
    }
    return [...fallbackPatients];
  }

  async getPatientById(id: string): Promise<Patient | null> {
    const db = await getMongoDb();
    if (db) {
      try {
        return await db.collection<Patient>('patients')
          .findOne({ id }, { projection: { _id: 0 } });
      } catch (err) {
        console.error('Failed to get patient by ID from MongoDB, using fallback:', err);
      }
    }
    const p = fallbackPatients.find(patient => patient.id === id);
    return p ? { ...p } : null;
  }

  async getPatientByToken(tokenNumber: number): Promise<Patient | null> {
    const db = await getMongoDb();
    if (db) {
      try {
        return await db.collection<Patient>('patients')
          .findOne({ tokenNumber }, { projection: { _id: 0 } });
      } catch (err) {
        console.error('Failed to get patient by token from MongoDB, using fallback:', err);
      }
    }
    const p = fallbackPatients.find(patient => patient.tokenNumber === tokenNumber);
    return p ? { ...p } : null;
  }

  async addPatient(patient: Patient): Promise<Patient> {
    const db = await getMongoDb();
    if (db) {
      try {
        const col = db.collection<Patient>('patients');
        // Validate duplicate check by phone + active status
        const isDuplicate = await col.findOne({
          phone: patient.phone,
          status: { $in: ['waiting', 'inProgress'] }
        });
        if (isDuplicate) {
          throw new Error(`Patient is already active in queue under this phone number.`);
        }
        await col.insertOne({ ...patient });
        return { ...patient };
      } catch (err: any) {
        if (err.message && err.message.includes('queue under this phone number')) {
          throw err;
        }
        console.error('Failed to add patient to MongoDB, trying fallback write:', err);
      }
    }

    // Fallback logic
    const isDuplicateFallback = fallbackPatients.some(
      p => p.phone === patient.phone && 
      (p.status === 'waiting' || p.status === 'inProgress')
    );
    if (isDuplicateFallback) {
      throw new Error(`Patient is already active in queue under this phone number.`);
    }
    fallbackPatients.push(patient);
    return { ...patient };
  }

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    const db = await getMongoDb();
    if (db) {
      try {
        const col = db.collection<Patient>('patients');
        await col.updateOne({ id }, { $set: updates });
        return await col.findOne({ id }, { projection: { _id: 0 } });
      } catch (err) {
        console.error('Failed to update patient in MongoDB, using fallback write:', err);
      }
    }

    const idx = fallbackPatients.findIndex(p => p.id === id);
    if (idx === -1) return null;
    
    fallbackPatients[idx] = { ...fallbackPatients[idx], ...updates };
    return { ...fallbackPatients[idx] };
  }

  async deletePatient(id: string): Promise<boolean> {
    const db = await getMongoDb();
    if (db) {
      try {
        const res = await db.collection<Patient>('patients').deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('Failed to delete patient in MongoDB, using fallback:', err);
      }
    }

    const idx = fallbackPatients.findIndex(p => p.id === id);
    if (idx === -1) return false;
    fallbackPatients.splice(idx, 1);
    return true;
  }

  async getDoctors(): Promise<Doctor[]> {
    const db = await getMongoDb();
    if (db) {
      try {
        const col = db.collection<Doctor>('doctors');
        const count = await col.countDocuments();
        if (count === 0) {
          await col.insertMany(doctors);
        }
        return await col.find({}, { projection: { _id: 0 } }).toArray();
      } catch (err) {
        console.error('Failed to get doctors from MongoDB, using fallback:', err);
      }
    }
    return [...doctors];
  }

  async getDoctorById(id: string): Promise<Doctor | null> {
    const db = await getMongoDb();
    if (db) {
      try {
        return await db.collection<Doctor>('doctors').findOne({ id }, { projection: { _id: 0 } });
      } catch (err) {
        console.error('Failed to get doctor from MongoDB, using fallback:', err);
      }
    }
    const doc = doctors.find(d => d.id === id);
    return doc ? { ...doc } : null;
  }

  async addConsultation(consultation: Consultation): Promise<Consultation> {
    const db = await getMongoDb();
    if (db) {
      try {
        await db.collection<Consultation>('consultations').insertOne({ ...consultation });
        return { ...consultation };
      } catch (err) {
        console.error('Failed to add consultation to MongoDB, using fallback write:', err);
      }
    }

    fallbackConsultations.push(consultation);
    return { ...consultation };
  }

  async getConsultations(): Promise<Consultation[]> {
    const db = await getMongoDb();
    if (db) {
      try {
        return await db.collection<Consultation>('consultations')
          .find({}, { projection: { _id: 0 } })
          .toArray();
      } catch (err) {
        console.error('Failed to get consultations from MongoDB, using fallback:', err);
      }
    }
    return [...fallbackConsultations];
  }

  async updateConsultation(patientId: string, doctorId: string, durationMinutes: number, endTime: string): Promise<Consultation | null> {
    const db = await getMongoDb();
    if (db) {
      try {
        const col = db.collection<Consultation>('consultations');
        await col.updateOne(
          { patientId, doctorId, endTime: null },
          { $set: { endTime, durationMinutes } }
        );
        return await col.findOne({ patientId, doctorId, endTime }, { projection: { _id: 0 } });
      } catch (err) {
        console.error('Failed to update consultation in MongoDB, using fallback write:', err);
      }
    }

    const idx = fallbackConsultations.findIndex(c => c.patientId === patientId && c.doctorId === doctorId && c.endTime === null);
    if (idx === -1) return null;

    fallbackConsultations[idx] = {
      ...fallbackConsultations[idx],
      endTime,
      durationMinutes
    };
    return { ...fallbackConsultations[idx] };
  }
}
