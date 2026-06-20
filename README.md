# QueueCare 26 — Real-Time Patient Queue Management System

QueueCare 26 is a premium, full-stack, real-time patient triage and queue optimization system designed for modern clinics and hospitals. It replaces obsolete paper ticket tokens with three live-synchronized dashboards (Receptionist, Patient Waiting Lounge, Doctor Desk) that feed from a single-source-of-truth Express server connected via Socket.IO.

---

## 🚀 Key Architectural highlights

1. **Starvation-Avoidance Queue Scheduling Algorithm**:
   - Priority weight scores are allocated based on medical urgency:
     - `Emergency` — `1000 points` base headstart
     - `Pregnant` — `400 points` base headstart
     - `Senior Citizen` — `200 points` base headstart
     - `Normal` — `0 points` base headstart
   - Patients accumulate **aging adjustment of +12 points/minute of waiting**. This guarantees high-priority critical cases are taken first, but ensures standard "Normal" patients are never starved of medical attention indefinitely.

2. **Smart Moving-Average Wait Predictor**:
   - Actual clinic session durations are tracked dynamically. The system computes a moving average of up to the last 15 completed consultation treatments.
   - Estimated delay is calculated as:
     $$\text{Estimated Wait Time} = \text{Triage Tokens Ahead} \times \text{Moving Average Consultation Duration}$$

3. **QR Code Tracking**:
   - Each registered patient gets a unique URL and responsive QR code. Scanning the QR code launches a mobile-first tracking console showing live tickers, tokens ahead, doctor assignments, and progress bars.

4. **Multi-Channel Synthesized Vocals**:
   - Browser Web Speech Synthesis API is engaged automatically during new doctor calls and patient recalls (e.g., *"Token 104, please proceed to Room 2"*), prompting patients auditory feedback.

---

## 🛠️ Tech Stack & Dependencies

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + React Router + `motion/react` + Recharts + `qrcode.react` + Lucide icons.
- **Backend / Real-time**: Node.js + Express + Socket.IO + `tsx` dev runner + `esbuild` production bundler.
- **database**:Mongodb Atlas.
- **Persistence**: Clean, data-isolated clean repository layer storing records `In-Memory` with explicit `// TODO: replace with database` markers, facilitating a seamless database plug-in later.

---

## 📡 Socket.IO Real-Time Event Catalog

| Event Name | Sent By | Payload Description | Purpose |
| :--- | :--- | :--- | :--- |
| `syncState` | Server | `{ patients: Patient[], stats: QueueStats, predictions: Object }` | Syncs full logs on socket initial connection / reconnect |
| `patientAdded` | Server | `Patient` | Emitted when a practitioner desk registers a patient card |
| `tokenCalled` | Server | `{ patient: Patient, doctor: Doctor, roomNumber: string }` | Emitted when patient is invited to a room. Triggers Speech Synthesis |
| `tokenSkipped` | Server | `Patient` | Emitted when receptionist marks patient skipped |
| `tokenRecalled` | Server | `{ patient: Patient, doctor: Doctor, roomNumber: string }` | Emitted when patient is recalled. Triggers Speech shake animation |
| `consultationStarted` | Server | `Patient` | Emitted when a doctor initiates treatment on active patient |
| `consultationCompleted` | Server | `Patient` | Emitted when consultation completes. Triggers predicted wait recompute |
| `queueUpdated` | Server | `{ patients: Patient[], predictions: Object }` | Broadcasts general wait position maps and active arrays |
| `analyticsUpdated` | Server | `QueueStats` | Broadcasts chart datapoints and general clinic metrics |

---

## 📋 REST API Documentation

### Patients
- **GET** `/api/patients` - Query current queue patient cards. Supports query parameters `search`, `doctorId`, and `status`.
- **GET** `/api/patients/:id` - Fetch single patient registry card (used for mobile QR trackers).
- **POST** `/api/patients` - Register patient and allocate token. Body: `{ name, age, phone, priority, doctorId }`.
- **PUT** `/api/patients/:id` - Edit patient info.
- **DELETE** `/api/patients/:id` - Flush/remove patient from active memory databases.

### Operations
- **POST** `/api/queue/call-next` - Call optimal waiting patient. Body: `{ doctorId }`.
- **POST** `/api/queue/skip` - Mark patient skipped. Body: `{ patientId }`.
- **POST** `/api/queue/recall` - Re-call/annoy patient. Body: `{ patientId }`.
- **POST** `/api/queue/cancel` - Set patient cancelled. Body: `{ patientId }`.
- **POST** `/api/queue/move-to-end` - Reset arrival timestamp of token. Body: `{ patientId }`.
- **POST** `/api/queue/complete` - Mark active consult complete and log session. Body: `{ patientId }`.

### Telemetry & Exports
- **GET** `/api/queue/stats` - Pull complete charts statistics.
- **GET** `/api/queue/predictions` - Query precise minutes predictions.
- **GET** `/api/analytics/export/json` - Download backup telemetry in JSON.
- **GET** `/api/analytics/export/csv` - Export administrative CSV sheet logs.

---

## 🏃 Setup & Local Execution

### 1. Verification
Install complete base node modules and dev dependencies:
```bash
npm install
```

### 2. Running in Development mode
Boot up the concurrent full-stack server running Express/Vite:
```bash
npm run dev
```
The server will bind on: **`http://localhost:3000`**

### 3. Production Compilation & Launch
Prepare assets bundles and bundle backend server using esbuild:
```bash
npm run build
npm start
```
By default, the compiled output launches from the common CommonJS module: `/dist/server.cjs`

---

## 🗄️ Database migration guide (Swapping Memory for SQL/Cloud)

The memory structures are centralized in `/server/repositories/patientRepository.ts`. To link a physical relational cloud SQL database (such as PostgreSQL with Cloud SQL or Firebase Firestore):

1. Find the target declarations labeled with `// TODO: Replace with database`.
2. Connect your schemas and swap arrays with active asynchronous query runners, for example:
   ```typescript
   // Inside PatientRepository
   async getPatients(): Promise<Patient[]> {
     // TODO: Replace with database:
     // return await db.select().from(patientsTable);
   }
   ```
3. Update connection URLs in your local `.env`.
