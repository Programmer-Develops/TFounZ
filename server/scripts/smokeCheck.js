import fs from 'fs';
import path from 'path';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

import app from '../app.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Meeting, { generateShowCode } from '../models/Meeting.js';
import Message from '../models/Message.js';
import Attendance from '../models/Attendance.js';
import ProductionJob from '../models/ProductionJob.js';
import * as sounzService from '../services/sounzService.js';
import * as filmyService from '../services/filmyService.js';
import { SHOW_PRESETS } from '../services/personas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSmokeChecks() {
  console.log('1. Express app & MVC imports verified:', typeof app === 'function');
  assert.strictEqual(SHOW_PRESETS.length, 6, 'Expected 6 show presets');

  // 2. Crypto show code format check
  const code = generateShowCode();
  assert.match(code, /^TFZ-[0-9A-F]{4}-[0-9A-F]{4}$/, `Invalid crypto code: ${code}`);
  console.log('2. Crypto show code check passed:', code);

  // 3. In-memory Mongoose schema validation checks (no live DB required)
  const validUser = new User({
    name: 'Smoke Tester',
    email: 'smoke@tfounz.studio',
    password: 'Password123!',
    role: 'host',
  });
  await validUser.validate();

  const invalidUser = new User({ name: 'A', email: 'bad-email', password: '123' });
  let validationCaught = false;
  try {
    await invalidUser.validate();
  } catch {
    validationCaught = true;
  }
  assert.strictEqual(validationCaught, true, 'Invalid User should fail Mongoose validation');

  const validMeeting = new Meeting({
    title: 'Smoke Test Talk Show',
    host: validUser._id,
    mode: 'ai-talkshow',
    showFormat: 'chai-with-ai',
  });
  await validMeeting.validate();

  const validMsg = new Message({
    meeting: validMeeting._id,
    senderName: 'Karan AI',
    senderType: 'ai',
    content: 'Welcome to the couch!',
  });
  await validMsg.validate();

  const validAttendance = new Attendance({
    meeting: validMeeting._id,
    user: validUser._id,
  });
  await validAttendance.validate();

  const validJob = new ProductionJob({
    meeting: validMeeting._id,
    createdBy: validUser._id,
    engine: 'sounz-ai',
    instruction: 'Normalize loudness',
  });
  await validJob.validate();
  console.log('3. All 5 Mongoose schemas passed validation checks.');

  // 4. JWT Access & Refresh signing + verification
  const accessToken = jwt.sign({ id: validUser._id.toString(), role: 'host' }, env.jwtAccessSecret, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ id: validUser._id.toString() }, env.jwtRefreshSecret, {
    expiresIn: '7d',
  });
  const decodedAccess = jwt.verify(accessToken, env.jwtAccessSecret);
  const decodedRefresh = jwt.verify(refreshToken, env.jwtRefreshSecret);
  assert.strictEqual(decodedAccess.role, 'host');
  assert.strictEqual(decodedRefresh.id, validUser._id.toString());
  console.log('4. JWT access & refresh signing/verification passed.');

  // 5. Postman collection JSON integrity check
  const postmanPath = path.resolve(__dirname, '../../docs/TFounZ_Postman_Collection.json');
  const postmanJson = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));
  assert.ok(Array.isArray(postmanJson.item) && postmanJson.item.length >= 6);
  console.log(`5. Postman collection valid JSON with ${postmanJson.item.length} folders.`);

  // 6. Live AI Services Health & SounZ Voices check
  const [sounzHealth, filmyHealth, voices] = await Promise.all([
    sounzService.checkHealth(),
    filmyService.checkHealth(),
    sounzService.getVoices(),
  ]);
  console.log('6. SounZ AI live health:', JSON.stringify(sounzHealth));
  console.log('7. Filmy AI live health:', JSON.stringify(filmyHealth));
  console.log(
    '8. SounZ AI voices retrieved:',
    `human=${voices.human_actor_zero_shot?.length || 0}`,
    `cartoon_anime=${voices.cartoon_anime_rvc?.length || 0}`,
    `fallback=${Boolean(voices.fallback)}`
  );
}

runSmokeChecks().catch((err) => {
  console.error('Smoke check failed:', err);
  process.exit(1);
});
