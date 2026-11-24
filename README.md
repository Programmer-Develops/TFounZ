# TFounZ Studio — AI Talk Show & Live Video Platform

**TFounZ Studio** reimagines the classic MERN video-meeting capstone (**Topic #1: MeetLite**) into an interactive **AI-Hosted Talk Show & Live Broadcast Studio** (*Chai with Karan AI*, *Midnight Hot Seat*, *Desi Roast Couch*, *Anime Couch*, *Shark Panel*, and *MeetLite Live Studio*), integrated server-side with **Filmy AI**, **SounZ AI**, and **Google Gemini**.

---

## Key Features

- **100% MeetLite Core + RBAC**:
  - `bcrypt` password hashing + JWT access & refresh token rotation (`POST /api/auth/refresh`)
  - Role-Based Access Control (`host`, `participant`, `admin`)
  - Unique show join codes generated with Node.js `crypto` (`TFZ-XXXX-XXXX`)
  - Real-time Socket.IO studio chat persisted to MongoDB (with text-index transcript search), live participant roster, Raise Hand, Host Kick, and End Show
  - 1-to-1 live video via browser **WebRTC** signaling
  - **MongoDB Aggregation Pipeline** attendance report (first join time, last leave time, total minutes, raised hands, messages, rapid-fire score) + CSV export
- **AI Talk Show Stage ("Chai with AI")**:
  - Split-screen TV couch pairing your live camera with an audio-reactive **2D Canvas Expressive Studio Avatar** (`glam`, `baritone`, `gamer`, `anime`, `panel`, `studio`)
  - Live voice & text banter powered by **Gemini** (`gemini-3.5-flash-lite`) with emotion cues, TV lower-third chyrons, and 60-second **Rapid-Fire Round**
  - Web Audio synthesized studio soundboard (`Applause`, `Laugh`, `Drumroll`, `Ba-Dum-Tss`, `Sip Chai`, `Buzzer`)
  - Composite `1280x720` Broadcast Clip Recorder (`MediaRecorder`) that captures both stage panes + ON AIR overlays and transfers straight into Post-Production
- **SounZ AI Audio & Voice Lab**:
  - Live character voice catalog (`GET /api/studio/voices`), in-browser **PCM WAV recorder** (`wavEncoder.js`), natural-language audio mastering, and Bollywood/Anime RVC voice conversion
- **Filmy AI Video Director**:
  - Upload or send recorded broadcast clips directly to Filmy AI for natural-language noise reduction, auto-subtitles, grayscale/speed/trim edits, and MP4 preview/download

---

## Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Fetch API, Context API, Socket.IO Client, WebRTC, HTML5 Canvas, Web Audio API
- **Backend**: Node.js, Express (MVC), Mongoose, Socket.IO, bcrypt, JSON Web Tokens, Multer
- **Database**: MongoDB Atlas
- **External AI Services** (server-side proxy via `.env`):
  - **Filmy AI**: `https://shantanu-pandya-filmy-ai-api.hf.space`
  - **SounZ AI**: `https://shantanu-pandya-sounz-ai.hf.space`
  - **Gemini API**: `gemini-3.5-flash-lite`

---

## Local Setup

### 1. Configure Backend (`server/.env`)
Copy `server/.env.example` to `server/.env` and fill in your MongoDB Atlas URI, JWT secrets, and Gemini API key:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/tfounz?retryWrites=true&w=majority
JWT_ACCESS_SECRET=your_long_random_access_secret
JWT_REFRESH_SECRET=your_long_random_refresh_secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
FILMY_AI_URL=https://shantanu-pandya-filmy-ai-api.hf.space
SOUNZ_AI_URL=https://shantanu-pandya-sounz-ai.hf.space
```

### 2. Install & Seed Backend
```bash
cd server
npm install
npm run seed   # seeds host@tfounz.studio, guest@tfounz.studio, admin@tfounz.studio (Password123!)
npm run dev
```

### 3. Install & Start Frontend
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## REST API Overview

| Group | Method & Path | Access | Purpose |
| :--- | :--- | :--- | :--- |
| Auth | `POST /api/auth/register` | Public | Register `host` or `participant` |
| Auth | `POST /api/auth/login` | Public | Login and receive access + refresh tokens |
| Auth | `POST /api/auth/refresh` | Public | Rotate JWT access & refresh tokens |
| Auth | `GET /api/auth/me` | Protected | Current user profile |
| Meetings | `GET /api/meetings/presets` | Public | 6 AI Talk Show & Studio presets |
| Meetings | `POST /api/meetings` | Host / Admin | Create show with `crypto` join code |
| Meetings | `GET /api/meetings/code/:code` | Protected | Join details + recent messages |
| Meetings | `GET /api/meetings/history` | Protected | Aggregated hosted/attended show list |
| Meetings | `GET /api/meetings/:id/messages?q=` | Protected | Search chat using MongoDB text index |
| Meetings | `GET /api/meetings/:id/attendance-report` | Host / Admin | MongoDB aggregation report |
| Meetings | `PATCH /api/meetings/:id/status` | Host / Admin | Transition `scheduled -> live -> ended` |
| Meetings | `POST /api/meetings/:id/remove-participant` | Host / Admin | Remove guest & close session |
| AI Show | `POST /api/ai-show/:meetingId/respond` | Protected | Gemini AI Host reply + emotion/SFX cue |
| AI Show | `POST /api/ai-show/:meetingId/rapid-fire` | Protected | Launch 60-second Rapid-Fire round |
| Studio | `GET /api/studio/health` | Protected | Ping Filmy AI, SounZ AI & Gemini status |
| Studio | `GET /api/studio/voices` | Protected | Live SounZ AI voices catalog |
| Studio | `POST /api/studio/sounz/process` | Protected | Upload audio & run SounZ AI instruction |
| Studio | `POST /api/studio/filmy/process` | Protected | Upload video & run Filmy AI instruction |
| Admin | `GET /api/admin/stats` | Admin RBAC | Platform-wide MongoDB aggregation stats |
| Admin | `PATCH /api/admin/users/:id/role` | Admin RBAC | Update user role |

Import [`docs/TFounZ_Postman_Collection.json`](docs/TFounZ_Postman_Collection.json) into Postman and inspect [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md) for the schema ER diagram and aggregation pipelines.

---

## Attribution

- **Filmy AI**: Powered by [Filmy-AI](https://github.com/programmer-develops/filmy-ai) by Shantanu Pandya (`https://shantanu-pandya-filmy-ai-api.hf.space`)
- **SounZ AI**: Powered by [SounZ-AI](https://github.com/Programmer-Develops/SounZ-AI) by Shantanu Pandya (`https://shantanu-pandya-sounz-ai.hf.space`)
