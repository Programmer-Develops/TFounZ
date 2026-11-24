import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Message from '../models/Message.js';
import Attendance from '../models/Attendance.js';
import { getPresetById } from '../services/personas.js';

async function seedDatabase() {
  await connectDB();

  const demoUsers = [
    {
      name: 'Studio Admin',
      email: 'admin@tfounz.studio',
      password: 'Password123!',
      role: 'admin',
      avatarColor: '#a855f7',
      bio: 'Platform administrator & show producer',
    },
    {
      name: 'Shantanu Host',
      email: 'host@tfounz.studio',
      password: 'Password123!',
      role: 'host',
      avatarColor: '#f5b041',
      bio: 'Creator of Filmy AI, SounZ AI & TFounZ Studio',
    },
    {
      name: 'Aarav Guest',
      email: 'guest@tfounz.studio',
      password: 'Password123!',
      role: 'participant',
      avatarColor: '#38bdf8',
      bio: 'Talk show guest & live studio audience member',
    },
  ];

  const usersByEmail = {};
  for (const data of demoUsers) {
    let user = await User.findOne({ email: data.email });
    if (!user) {
      user = await User.create(data);
      console.log(`Created demo user: ${user.email} (${user.role})`);
    } else {
      console.log(`Found existing user: ${user.email} (${user.role})`);
    }
    usersByEmail[data.email] = user;
  }

  const host = usersByEmail['host@tfounz.studio'];
  const guest = usersByEmail['guest@tfounz.studio'];

  const sampleCode = 'TFZ-CHAI-2026';
  let meeting = await Meeting.findOne({ code: sampleCode });
  if (!meeting) {
    const preset = getPresetById('chai-with-ai');
    const startedAt = new Date(Date.now() - 45 * 60000);
    const endedAt = new Date(Date.now() - 12 * 60000);

    meeting = await Meeting.create({
      title: 'Chai with Karan AI — Season Finale Demo',
      description:
        'Sample recorded episode demonstrating MeetLite attendance aggregation, Rapid-Fire scores, and AI couch banter.',
      code: sampleCode,
      host: host._id,
      mode: 'ai-talkshow',
      showFormat: 'chai-with-ai',
      aiPersona: {
        id: preset.id,
        name: preset.name,
        tagline: preset.tagline,
        sounzVoiceId: preset.sounzVoiceId,
        accentColor: preset.accentColor,
        avatarStyle: preset.avatarStyle,
      },
      status: 'ended',
      scheduledAt: startedAt,
      startedAt,
      endedAt,
      rapidFireHighScore: 45,
    });

    await Message.insertMany([
      {
        meeting: meeting._id,
        sender: null,
        senderName: preset.name,
        senderType: 'ai',
        content: preset.openingLine,
        emotion: 'applause',
        sfxCue: 'applause',
      },
      {
        meeting: meeting._id,
        sender: guest._id,
        senderName: guest.name,
        senderType: 'user',
        content: 'Honestly, debugging WebRTC at 2 AM with hot masala chai is my whole personality!',
        isRapidFire: true,
      },
      {
        meeting: meeting._id,
        sender: null,
        senderName: preset.name,
        senderType: 'ai',
        content:
          '2 AM debugging AND masala chai?! Give this developer the golden Chai Hamper immediately!',
        emotion: 'laugh',
        sfxCue: 'sip_tea',
        isRapidFire: true,
      },
    ]);

    await Attendance.insertMany([
      {
        meeting: meeting._id,
        user: host._id,
        joinedAt: startedAt,
        leftAt: endedAt,
        durationMinutes: 33,
        raisedHandCount: 0,
        messagesSent: 4,
        rapidFireScore: 0,
      },
      {
        meeting: meeting._id,
        user: guest._id,
        joinedAt: new Date(startedAt.getTime() + 2 * 60000),
        leftAt: endedAt,
        durationMinutes: 31,
        raisedHandCount: 2,
        messagesSent: 7,
        rapidFireScore: 45,
      },
    ]);

    console.log(`Seeded sample show: ${sampleCode}`);
  } else {
    console.log(`Sample show already exists: ${sampleCode}`);
  }

  await mongoose.disconnect();
  console.log('Seed completed cleanly.');
}

seedDatabase().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
