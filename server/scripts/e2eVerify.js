import http from 'http';
import assert from 'assert';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { io as createClientSocket } from '../../client/node_modules/socket.io-client/build/esm/index.js';

import app from '../app.js';
import { connectDB } from '../config/db.js';
import { attachMeetingSocket } from '../socket/meetingSocket.js';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Attendance from '../models/Attendance.js';
import ProductionJob from '../models/ProductionJob.js';

async function api(baseUrl, path, { method = 'GET', token = '', body = null } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function waitEvent(socket, event, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for socket event '${event}'`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

async function runE2E() {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);
  attachMeetingSocket(io);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const hostEmail = `e2e.host.${suffix}@tfounz.test`;
  const guestEmail = `e2e.guest.${suffix}@tfounz.test`;
  let createdMeetingId = null;
  let hostUserId = null;
  let guestUserId = null;
  let hostSock = null;
  let guestSock = null;

  try {
    // 1. Register Host + Participant + Refresh Token + RBAC check
    const regHost = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'E2E Host', email: hostEmail, password: 'Password123!', role: 'host' },
    });
    assert.strictEqual(regHost.status, 201, `Host register failed: ${JSON.stringify(regHost.json)}`);
    let hostToken = regHost.json.data.accessToken;
    const hostRefresh = regHost.json.data.refreshToken;
    hostUserId = regHost.json.data.user._id;

    const refreshed = await api(baseUrl, '/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: hostRefresh },
    });
    assert.strictEqual(refreshed.status, 200, 'Refresh rotation should succeed');
    hostToken = refreshed.json.data.accessToken;

    const regGuest = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'E2E Guest', email: guestEmail, password: 'Password123!', role: 'participant' },
    });
    assert.strictEqual(regGuest.status, 201);
    const guestToken = regGuest.json.data.accessToken;
    guestUserId = regGuest.json.data.user._id;

    // RBAC checks: participant cannot create show or view admin stats
    const rbacCreate = await api(baseUrl, '/api/meetings', {
      method: 'POST',
      token: guestToken,
      body: { title: 'Unauthorized Show' },
    });
    assert.strictEqual(rbacCreate.status, 403, 'Participant should get 403 on create meeting');

    const rbacAdmin = await api(baseUrl, '/api/admin/stats', { token: guestToken });
    assert.strictEqual(rbacAdmin.status, 403, 'Participant should get 403 on admin stats');
    console.log('PASS [1/6] Auth register, JWT refresh rotation, and RBAC 403 enforcement');

    // 2. Presets + Create AI Guest Show
    const presetsRes = await api(baseUrl, '/api/meetings/presets');
    assert.strictEqual(presetsRes.status, 200);
    assert.strictEqual(presetsRes.json.data.presets.length, 6);
    assert.strictEqual(presetsRes.json.data.guestPresets.length, 4);

    const createShow = await api(baseUrl, '/api/meetings', {
      method: 'POST',
      token: hostToken,
      body: {
        title: 'E2E Celebrity Interview with King Khan AI',
        showFormat: 'guest-superstar',
        mode: 'ai-talkshow',
        aiRole: 'guest',
      },
    });
    assert.strictEqual(createShow.status, 201);
    const meeting = createShow.json.data.meeting;
    createdMeetingId = meeting._id;
    assert.strictEqual(meeting.aiRole, 'guest');
    assert.match(meeting.code, /^TFZ-[0-9A-F]{4}-[0-9A-F]{4}$/);
    console.log('PASS [2/6] Show presets (6 host + 4 guest) & AI Guest show created:', meeting.code);

    // 3. Real Socket.IO Multi-Participant Join, WebRTC Signaling, Chat, Hand Raise & Kick
    hostSock = createClientSocket(baseUrl, { auth: { token: hostToken }, transports: ['websocket'] });
    guestSock = createClientSocket(baseUrl, { auth: { token: guestToken }, transports: ['websocket'] });

    await Promise.all([waitEvent(hostSock, 'connect'), waitEvent(guestSock, 'connect')]);

    const hostJoinedP = waitEvent(hostSock, 'room:joined');
    hostSock.emit('room:join', { code: meeting.code });
    await hostJoinedP;

    const guestJoinedP = waitEvent(guestSock, 'room:joined');
    const webrtcReadyOnHostP = waitEvent(hostSock, 'webrtc:ready');
    guestSock.emit('room:join', { code: meeting.code });
    const guestJoined = await guestJoinedP;
    assert.strictEqual(guestJoined.participants.length, 2, 'Expected 2 participants in room');

    guestSock.emit('webrtc:ready', { code: meeting.code });
    const readyPayload = await webrtcReadyOnHostP;
    assert.strictEqual(readyPayload.name, 'E2E Guest');

    // Relay WebRTC offer -> guest
    const offerOnGuestP = waitEvent(guestSock, 'webrtc:offer');
    hostSock.emit('webrtc:offer', {
      code: meeting.code,
      targetSocketId: readyPayload.fromSocketId,
      sdp: { type: 'offer', sdp: 'v=0-e2e-mock' },
    });
    const receivedOffer = await offerOnGuestP;
    assert.strictEqual(receivedOffer.sdp.type, 'offer');

    // Chat + Hand Raise
    const chatReceivedP = waitEvent(hostSock, 'chat:message');
    guestSock.emit('chat:send', { code: meeting.code, content: 'Hello live studio from E2E Guest!' });
    const chatMsg = await chatReceivedP;
    assert.strictEqual(chatMsg.content, 'Hello live studio from E2E Guest!');

    const handP = waitEvent(hostSock, 'hand:updated');
    guestSock.emit('hand:toggle', { code: meeting.code });
    const handEvt = await handP;
    assert.strictEqual(handEvt.handRaised, true);

    // Kick guest + verify 403 security block on messages & AI respond
    const kickedP = waitEvent(guestSock, 'room:kicked');
    hostSock.emit('host:remove-participant', { code: meeting.code, targetUserId: guestUserId });
    const kickedEvt = await kickedP;
    assert.strictEqual(kickedEvt.targetUserId, guestUserId);

    const kickedMsgFetch = await api(baseUrl, `/api/meetings/${createdMeetingId}/messages`, {
      token: guestToken,
    });
    assert.strictEqual(kickedMsgFetch.status, 403, 'Kicked user must get 403 on GET /messages');

    const kickedAiRespond = await api(baseUrl, `/api/ai-show/${createdMeetingId}/respond`, {
      method: 'POST',
      token: guestToken,
      body: { userMessage: 'Trying to talk after kick' },
    });
    assert.strictEqual(kickedAiRespond.status, 403, 'Kicked user must get 403 on AI respond');
    console.log('PASS [3/6] Socket.IO multi-user join, WebRTC signaling relay, chat, hand raise & kick security');

    // 4. Live Gemini AI Guest Interview + Rapid-Fire + Summary
    const aiResp = await api(baseUrl, `/api/ai-show/${createdMeetingId}/respond`, {
      method: 'POST',
      token: hostToken,
      body: { userMessage: 'Welcome to my show! What is your biggest secret to winning over an audience?' },
    });
    assert.strictEqual(aiResp.status, 200);
    assert.strictEqual(aiResp.json.data.aiRole, 'guest');
    assert.ok(aiResp.json.data.reply.length > 10);

    const rfRes = await api(baseUrl, `/api/ai-show/${createdMeetingId}/rapid-fire`, {
      method: 'POST',
      token: hostToken,
      body: { topic: 'Cinema & Creativity' },
    });
    assert.strictEqual(rfRes.status, 200);
    assert.strictEqual(rfRes.json.data.questions.length, 5);

    const sumRes = await api(baseUrl, `/api/ai-show/${createdMeetingId}/summary`, {
      method: 'POST',
      token: hostToken,
    });
    assert.strictEqual(sumRes.status, 200);
    assert.ok(sumRes.json.data.headline && sumRes.json.data.suggestedFilmyPrompt);
    console.log(
      `PASS [4/6] Live Gemini AI Guest reply (${aiResp.json.data.source}/${aiResp.json.data.modelUsed || 'fallback'}), Rapid-Fire, and Episode Summary`
    );

    // 5. Live SounZ AI Speech Synthesis + Streaming Proxy Download
    const speakRes = await api(baseUrl, `/api/ai-show/${createdMeetingId}/speak`, {
      method: 'POST',
      token: hostToken,
      body: { text: 'Thank you for having me on TFounZ Studio!', sfxCue: 'applause' },
    });
    assert.strictEqual(speakRes.status, 200, `SounZ speak failed: ${JSON.stringify(speakRes.json)}`);
    const dlUrl = speakRes.json.data.downloadUrl;
    const audioRes = await fetch(`${baseUrl}${dlUrl}`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    assert.strictEqual(audioRes.status, 200);
    const audioBytes = (await audioRes.arrayBuffer()).byteLength;
    assert.ok(audioBytes > 1000, `Expected real MP3 bytes from SounZ AI, got ${audioBytes}`);
    console.log(`PASS [5/6] Live SounZ AI TTS synthesis & streaming proxy download (${audioBytes} bytes MP3)`);

    // 6. End Show + Verify Ended Block + MongoDB Aggregation Attendance Report
    const endRes = await api(baseUrl, `/api/meetings/${createdMeetingId}/status`, {
      method: 'PATCH',
      token: hostToken,
      body: { status: 'ended' },
    });
    assert.strictEqual(endRes.status, 200);

    const endedRf = await api(baseUrl, `/api/ai-show/${createdMeetingId}/rapid-fire`, {
      method: 'POST',
      token: hostToken,
      body: {},
    });
    assert.strictEqual(endedRf.status, 400, 'Rapid-fire on ended show should return 400');

    const reportRes = await api(baseUrl, `/api/meetings/${createdMeetingId}/attendance-report`, {
      token: hostToken,
    });
    assert.strictEqual(reportRes.status, 200);
    assert.strictEqual(reportRes.json.data.participants.length, 2, 'Expected 2 participants in attendance report');
    const guestRow = reportRes.json.data.participants.find((p) => p.userId === guestUserId);
    assert.ok(guestRow && guestRow.raisedHandCount >= 1 && guestRow.messagesSent >= 1 && guestRow.totalMinutes > 0);
    console.log('PASS [6/6] End Show + MongoDB Aggregation Attendance Report verified:', {
      participants: reportRes.json.data.summary.totalParticipants,
      totalMessages: reportRes.json.data.summary.totalMessages,
      guestRow: {
        minutes: guestRow.totalMinutes,
        hands: guestRow.raisedHandCount,
        msgs: guestRow.messagesSent,
      },
    });
  } finally {
    hostSock?.disconnect();
    guestSock?.disconnect();
    if (createdMeetingId) {
      await Promise.all([
        Message.deleteMany({ meeting: createdMeetingId }),
        Attendance.deleteMany({ meeting: createdMeetingId }),
        ProductionJob.deleteMany({ meeting: createdMeetingId }),
        Meeting.deleteOne({ _id: createdMeetingId }),
      ]);
    }
    await User.deleteMany({ _id: { $in: [hostUserId, guestUserId].filter(Boolean) } });
    io.close();
    server.close();
    await mongoose.disconnect();
  }
}

runE2E().catch((err) => {
  console.error('E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
