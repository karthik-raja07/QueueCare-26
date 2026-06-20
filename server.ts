import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { QueueService } from './server/services/queueService';
import { getMongoDb, getDbStatus } from './server/lib/mongodb';

const queueService = new QueueService();

async function startServer() {
  // Pre-initialize and test MongoDB connection eagerly
  getMongoDb().catch(err => console.error("Eager MongoDB connection attempt failed:", err));

  const app = express();
  const server = http.createServer(app);
  
  // Configure Socket.IO server with CORS allowed for local dev
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    }
  });

  const PORT = 3000;

  app.use(express.json());

  // Socket state tracking as connection status
  io.on('connection', async (socket) => {
    console.log(`Socket client connected: ${socket.id}`);
    
    // Initial sync of patients and stats
    try {
      const patients = await queueService.getPatients();
      const stats = await queueService.getQueueStats();
      const predictions = await queueService.getEstimatedWaitTimes();
      
      socket.emit('syncState', { patients, stats, predictions });
    } catch (err) {
      console.error('Error in socket initial sync:', err);
    }

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  // Helper helper to broadcast updates to all sockets
  const broadcastStateUpdate = async (causingEvent: string, eventData: any = {}) => {
    try {
      const patients = await queueService.getPatients();
      const stats = await queueService.getQueueStats();
      const predictions = await queueService.getEstimatedWaitTimes();

      // Emit specific event
      io.emit(causingEvent, eventData);
      
      // Emit mass sync
      io.emit('queueUpdated', { patients, predictions });
      io.emit('analyticsUpdated', stats);
    } catch (err) {
      console.error('State broadcast failed:', err);
    }
  };

  // ==========================================
  // API ENDPOINTS
  // ==========================================

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // GET db-status
  app.get('/api/db-status', (req, res) => {
    res.json(getDbStatus());
  });

  // GET doctors
  app.get('/api/doctors', async (req, res) => {
    try {
      const docs = await queueService.getDoctors();
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET patients
  app.get('/api/patients', async (req, res) => {
    try {
      const search = req.query.search as string;
      const doctorId = req.query.doctorId as string;
      const status = req.query.status as string;
      const list = await queueService.getPatients(search, doctorId, status);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single patient for tracking
  app.get('/api/patients/:id', async (req, res) => {
    try {
      const patient = await queueService.getPatientById(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      res.json(patient);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST patient registration
  app.post('/api/patients', async (req, res) => {
    try {
      const { name, age, phone, priority, doctorId } = req.body;
      if (!name || !age || !phone || !priority || !doctorId) {
        return res.status(400).json({ error: 'Missing required registration parameters' });
      }
      
      const newPatient = await queueService.addPatient({ name, age, phone, priority, doctorId });
      
      await broadcastStateUpdate('patientAdded', newPatient);
      res.status(201).json(newPatient);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT update patient
  app.put('/api/patients/:id', async (req, res) => {
    try {
      const updated = await queueService.updatePatient(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      await broadcastStateUpdate('patientUpdated', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE patient
  app.delete('/api/patients/:id', async (req, res) => {
    try {
      const deleted = await queueService.deletePatient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      await broadcastStateUpdate('patientDeleted', { id: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST queue operations: Call Next for specific doctor
  // Guarded against double-calling races
  let callNextLock = false;
  app.post('/api/queue/call-next', async (req, res) => {
    if (callNextLock) {
      return res.status(429).json({ error: 'Operation in progress, please try again.' });
    }
    callNextLock = true;
    try {
      const { doctorId } = req.body;
      if (!doctorId) {
        callNextLock = false;
        return res.status(400).json({ error: 'Missing doctorId parameter' });
      }

      const activePatient = await queueService.callNextToken(doctorId);
      if (!activePatient) {
        callNextLock = false;
        return res.status(404).json({ error: 'Queue is empty for this doctor.' });
      }

      const docs = await queueService.getDoctors();
      const assignedDoc = docs.find(d => d.id === doctorId);

      await broadcastStateUpdate('tokenCalled', {
        patient: activePatient,
        doctor: assignedDoc || null,
        roomNumber: assignedDoc?.roomNumber || 'Consultation Room'
      });
      
      await broadcastStateUpdate('consultationStarted', activePatient);
      
      callNextLock = false;
      res.json(activePatient);
    } catch (err: any) {
      callNextLock = false;
      res.status(500).json({ error: err.message });
    }
  });

  // POST skip token
  app.post('/api/queue/skip', async (req, res) => {
    try {
      const { patientId } = req.body;
      const updated = await queueService.skipToken(patientId);
      if (!updated) {
        return res.status(404).json({ error: 'Patient not found or invalid' });
      }
      
      await broadcastStateUpdate('tokenSkipped', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST recall token (Shake animation trigger)
  app.post('/api/queue/recall', async (req, res) => {
    try {
      const { patientId } = req.body;
      const updated = await queueService.recallToken(patientId);
      if (!updated) {
        return res.status(404).json({ error: 'Patient not found or invalid' });
      }

      const docs = await queueService.getDoctors();
      const assignedDoc = docs.find(d => d.id === updated.doctorId);
      
      await broadcastStateUpdate('tokenRecalled', {
        patient: updated,
        doctor: assignedDoc || null,
        roomNumber: assignedDoc?.roomNumber || 'Consultation Room'
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST cancel token
  app.post('/api/queue/cancel', async (req, res) => {
    try {
      const { patientId } = req.body;
      const updated = await queueService.cancelToken(patientId);
      if (!updated) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      await broadcastStateUpdate('tokenCancelled', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST move token to end
  app.post('/api/queue/move-to-end', async (req, res) => {
    try {
      const { patientId } = req.body;
      const updated = await queueService.moveTokenToEnd(patientId);
      if (!updated) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      await broadcastStateUpdate('tokenMovedToEnd', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST complete consultation
  app.post('/api/queue/complete', async (req, res) => {
    try {
      const { patientId } = req.body;
      const updated = await queueService.completeConsultation(patientId);
      if (!updated) {
        return res.status(404).json({ error: 'Patient has no active consultation or cannot be completed' });
      }
      
      await broadcastStateUpdate('consultationCompleted', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET complete queue statistics
  app.get('/api/queue/stats', async (req, res) => {
    try {
      const stats = await queueService.getQueueStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET predictions Map for waiting patients
  app.get('/api/queue/predictions', async (req, res) => {
    try {
      const doctorId = req.query.doctorId as string;
      const map = await queueService.getEstimatedWaitTimes(doctorId);
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PREMIUM DATA EXPORT ENGINES
  // ==========================================
  app.get('/api/analytics/export/json', async (req, res) => {
    try {
      const list = await queueService.getPatients();
      const stats = await queueService.getQueueStats();
      res.setHeader('Content-disposition', 'attachment; filename=QueueCare-Analytics.json');
      res.setHeader('Content-type', 'application/json');
      res.send(JSON.stringify({ exportedAt: new Date().toISOString(), stats, patients: list }, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/analytics/export/csv', async (req, res) => {
    try {
      const list = await queueService.getPatients();
      let csv = 'Token,Name,Age,Phone,Priority,Assigned Doctor ID,Status,Registered At,Called At,Completed At\n';
      
      list.forEach(p => {
        csv += `${p.tokenNumber},"${p.name.replace(/"/g, '""')}",${p.age},"${p.phone}",${p.priority},${p.doctorId},${p.status},"${p.createdAt}","${p.calledAt || ''}","${p.completedAt || ''}"\n`;
      });

      res.setHeader('Content-disposition', 'attachment; filename=QueueCare-Telemetry-Export.csv');
      res.setHeader('Content-type', 'text/csv');
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve static assets or use Vite in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`QueueCare 26 dynamic full-stack server online: http://localhost:${PORT}`);
  });
}

startServer();
