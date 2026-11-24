const THEME_PALETTES = {
  glam: {
    bgTop: '#241432',
    bgBottom: '#0d0916',
    suit: '#2e1640',
    shirt: '#fdf4e7',
    tie: '#f5b041',
    skin: '#d99c72',
    hair: '#1f1924',
    accent: '#f5b041',
    glasses: true,
    prop: 'chai',
  },
  baritone: {
    bgTop: '#2a131a',
    bgBottom: '#0c080d',
    suit: '#1d1c28',
    shirt: '#f8fafc',
    tie: '#e67e22',
    skin: '#cfa17d',
    hair: '#d5d8dc',
    accent: '#e67e22',
    glasses: true,
    beard: true,
    prop: 'mic',
  },
  gamer: {
    bgTop: '#2b0f22',
    bgBottom: '#0a0812',
    suit: '#181826',
    shirt: '#ff4d6d',
    tie: null,
    skin: '#d99e78',
    hair: '#14141d',
    accent: '#ff4d6d',
    headphones: true,
    prop: 'controller',
  },
  anime: {
    bgTop: '#0d2238',
    bgBottom: '#070c16',
    suit: '#101524',
    shirt: '#1e293b',
    tie: '#38bdf8',
    skin: '#f4d3bd',
    hair: '#eef6ff',
    accent: '#38bdf8',
    shades: true,
    prop: 'aura',
  },
  panel: {
    bgTop: '#0d2922',
    bgBottom: '#080e12',
    suit: '#122436',
    shirt: '#eef6fa',
    tie: '#2ee59d',
    skin: '#cf956b',
    hair: '#1b1d26',
    accent: '#2ee59d',
    prop: 'mic',
  },
  studio: {
    bgTop: '#1f1436',
    bgBottom: '#0a0814',
    suit: '#2a1a4a',
    shirt: '#f3e8ff',
    tie: '#a855f7',
    skin: '#dfb190',
    hair: '#24182b',
    accent: '#a855f7',
    prop: 'mic',
  },
};

const EMOTION_BADGES = {
  neutral: '🎙️ ON AIR',
  laugh: '😂 HAHAHA!',
  shock: '😲 NO WAY!',
  roast: '🔥 ROASTED!',
  applause: '👏 ICONIC!',
  think: '🤔 HMMM...',
};

export function drawStudioAvatar(ctx, width, height, state) {
  const {
    avatarStyle = 'glam',
    hostName = 'Karan AI',
    aiRole = 'host',
    emotion = 'neutral',
    mouthOpen = 0,
    isSpeaking = false,
    tick = 0,
  } = state;

  const palette = THEME_PALETTES[avatarStyle] || THEME_PALETTES.glam;

  // 1. Studio Backdrop Gradient
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Spotlight Halo
  const cx = width * 0.5;
  const cy = height * 0.45;
  const haloRadius = width * (0.34 + mouthOpen * 0.04);
  const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, haloRadius);
  halo.addColorStop(0, `${palette.accent}44`);
  halo.addColorStop(0.6, `${palette.accent}12`);
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  // 3. Audio Equalizer Bars on the Studio Wall
  const barCount = 16;
  const barW = 8;
  const gap = 14;
  const totalBarsW = barCount * (barW + gap);
  const startX = (width - totalBarsW) / 2;
  ctx.fillStyle = `${palette.accent}55`;
  for (let i = 0; i < barCount; i++) {
    const wave = isSpeaking
      ? Math.abs(Math.sin(tick * 0.16 + i * 0.65)) * (14 + mouthOpen * 42)
      : 6 + Math.abs(Math.sin(tick * 0.04 + i * 0.5)) * 8;
    ctx.beginPath();
    ctx.roundRect(startX + i * (barW + gap), height * 0.48 - wave / 2, barW, wave, 4);
    ctx.fill();
  }

  // Subtle floating idle motion
  const bobY = Math.sin(tick * 0.05) * 3 + (isSpeaking ? -mouthOpen * 3 : 0);

  // 4. Couch / Chair Silhouette
  ctx.fillStyle = '#1d1629';
  ctx.beginPath();
  ctx.roundRect(width * 0.16, height * 0.62, width * 0.68, height * 0.38, 30);
  ctx.fill();
  ctx.strokeStyle = `${palette.accent}35`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. Shoulders & Suit
  ctx.save();
  ctx.translate(cx, height * 0.8 + bobY * 0.5);

  ctx.fillStyle = palette.suit;
  ctx.beginPath();
  ctx.moveTo(-115, 70);
  ctx.quadraticCurveTo(-105, -26, -32, -38);
  ctx.lineTo(32, -38);
  ctx.quadraticCurveTo(105, -26, 115, 70);
  ctx.closePath();
  ctx.fill();

  // Shirt V-neck
  ctx.fillStyle = palette.shirt;
  ctx.beginPath();
  ctx.moveTo(-26, -38);
  ctx.lineTo(0, 38);
  ctx.lineTo(26, -38);
  ctx.closePath();
  ctx.fill();

  if (palette.tie) {
    ctx.fillStyle = palette.tie;
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(8, -32);
    ctx.lineTo(5, 36);
    ctx.lineTo(0, 44);
    ctx.lineTo(-5, 36);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 6. Neck & Head
  const headX = cx;
  const headY = height * 0.44 + bobY;

  // Neck
  ctx.fillStyle = palette.skin;
  ctx.fillRect(headX - 18, headY + 46, 36, 40);

  // Ears
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(headX - 58, headY + 6, 12, 0, Math.PI * 2);
  ctx.arc(headX + 58, headY + 6, 12, 0, Math.PI * 2);
  ctx.fill();

  // Head Oval
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 56, 68, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.ellipse(headX, headY - 40, 58, 32, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (avatarStyle === 'anime') {
    // Spiky anime bangs
    ctx.beginPath();
    ctx.moveTo(headX - 54, headY - 34);
    ctx.lineTo(headX - 35, headY - 76);
    ctx.lineTo(headX - 15, headY - 48);
    ctx.lineTo(headX + 5, headY - 82);
    ctx.lineTo(headX + 26, headY - 46);
    ctx.lineTo(headX + 46, headY - 74);
    ctx.lineTo(headX + 56, headY - 34);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(headX - 56, headY - 22);
    ctx.quadraticCurveTo(headX - 10, headY - 74, headX + 56, headY - 22);
    ctx.quadraticCurveTo(headX, headY - 48, headX - 56, headY - 22);
    ctx.fill();
  }

  // Beard for baritone theme
  if (palette.beard) {
    ctx.fillStyle = palette.hair;
    ctx.beginPath();
    ctx.ellipse(headX, headY + 34, 42, 32, 0, 0, Math.PI);
    ctx.fill();
  }

  // 7. Eyes & Brows
  const blink = tick % 170 > 164;
  const browLift = emotion === 'shock' ? -7 : emotion === 'roast' ? 3 : 0;

  ctx.strokeStyle = '#1b1520';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headX - 34, headY - 16 + browLift);
  ctx.lineTo(headX - 12, headY - 19 + (emotion === 'roast' ? 4 : browLift));
  ctx.moveTo(headX + 12, headY - 19 + (emotion === 'roast' ? 4 : browLift));
  ctx.lineTo(headX + 34, headY - 16 + browLift);
  ctx.stroke();

  if (palette.shades) {
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(headX - 42, headY - 12, 36, 20, 6);
    ctx.roundRect(headX + 6, headY - 12, 36, 20, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY - 4);
    ctx.lineTo(headX + 6, headY - 4);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#14111c';
    if (blink || emotion === 'laugh') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(headX - 22, headY - 2, 9, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(headX + 22, headY - 2, 9, Math.PI, Math.PI * 2);
      ctx.stroke();
    } else {
      const eyeR = emotion === 'shock' ? 7 : 5.5;
      ctx.beginPath();
      ctx.arc(headX - 22, headY - 2, eyeR, 0, Math.PI * 2);
      ctx.arc(headX + 22, headY - 2, eyeR, 0, Math.PI * 2);
      ctx.fill();
      // Eye sparkle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(headX - 20, headY - 4, 2, 0, Math.PI * 2);
      ctx.arc(headX + 24, headY - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (palette.glasses) {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(headX - 38, headY - 13, 31, 22, 6);
      ctx.roundRect(headX + 7, headY - 13, 31, 22, 6);
      ctx.moveTo(headX - 7, headY - 2);
      ctx.lineTo(headX + 7, headY - 2);
      ctx.stroke();
    }
  }

  // Headphones for Gamer host
  if (palette.headphones) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(headX, headY - 4, 62, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(headX - 70, headY - 14, 16, 36, 7);
    ctx.roundRect(headX + 54, headY - 14, 16, 36, 7);
    ctx.fill();
  }

  // 8. Mouth (real-time lip-sync)
  const openHeight = 4 + mouthOpen * 22 + (emotion === 'laugh' ? 6 : 0);
  const mouthW = emotion === 'shock' ? 12 : 20 + mouthOpen * 6;
  ctx.fillStyle = '#3c1321';
  ctx.beginPath();
  ctx.ellipse(headX, headY + 32, mouthW, Math.max(3, openHeight * 0.55), 0, 0, Math.PI * 2);
  ctx.fill();

  if (openHeight > 9) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(headX - mouthW * 0.55, headY + 26, mouthW * 1.1, 4, 2);
    ctx.fill();
  }

  // 9. Props (Chai mug or Studio Mic)
  if (palette.prop === 'chai') {
    const mugX = cx + 98;
    const mugY = height * 0.72 + bobY;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(mugX, mugY, 34, 38, 7);
    ctx.fill();
    ctx.strokeStyle = '#f5b041';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mugX + 35, mugY + 18, 9, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Steam wisps
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let s = 0; s < 2; s++) {
      const drift = Math.sin(tick * 0.08 + s * 2) * 4;
      ctx.beginPath();
      ctx.moveTo(mugX + 10 + s * 14, mugY - 4);
      ctx.quadraticCurveTo(mugX + 14 + s * 14 + drift, mugY - 18, mugX + 8 + s * 14, mugY - 28);
      ctx.stroke();
    }
  } else if (palette.prop === 'mic') {
    const micX = cx - 96;
    const micY = height * 0.72;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(micX - 24, height);
    ctx.lineTo(micX, micY);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.roundRect(micX - 10, micY - 22, 20, 28, 9);
    ctx.fill();
  }

  // 10. Top-Right Emotion Reaction Pill
  const badgeText = EMOTION_BADGES[emotion] || EMOTION_BADGES.neutral;
  ctx.font = '700 13px Outfit, sans-serif';
  const tw = ctx.measureText(badgeText).width;
  ctx.fillStyle = 'rgba(10, 9, 18, 0.78)';
  ctx.beginPath();
  ctx.roundRect(width - tw - 36, 14, tw + 22, 28, 14);
  ctx.fill();
  ctx.strokeStyle = `${palette.accent}88`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Top-right emotion badge sits cleanly opposite the DOM ON-AIR pill (no top-left overlap)
  ctx.fillStyle = '#fff';
  ctx.fillText(badgeText, width - tw - 25, 32);
}
