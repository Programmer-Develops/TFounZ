const THEME_PALETTES = {
  glam: {
    bgTop: '#161310',
    bgBottom: '#08080A',
    suit: '#221D18',
    shirt: '#F3EFE6',
    tie: '#C9A96E',
    skin: '#C8946E',
    hair: '#1B1817',
    accent: '#C9A96E',
    glasses: true,
    prop: 'chai',
  },
  baritone: {
    bgTop: '#161113',
    bgBottom: '#08080A',
    suit: '#1B1A20',
    shirt: '#F3EFE6',
    tie: '#B8895C',
    skin: '#BE8F6F',
    hair: '#CFCBC4',
    accent: '#C4934E',
    glasses: true,
    beard: true,
    prop: 'mic',
  },
  gamer: {
    bgTop: '#161013',
    bgBottom: '#08080A',
    suit: '#191920',
    shirt: '#292228',
    tie: null,
    skin: '#C89674',
    hair: '#151519',
    accent: '#C85E67',
    headphones: true,
    prop: 'mic',
  },
  anime: {
    bgTop: '#0F1419',
    bgBottom: '#08080A',
    suit: '#141820',
    shirt: '#1E242E',
    tie: '#82A6BD',
    skin: '#DEC2AE',
    hair: '#ECEAE4',
    accent: '#8FB4CB',
    shades: true,
    prop: 'mic',
  },
  panel: {
    bgTop: '#0F1513',
    bgBottom: '#08080A',
    suit: '#161E22',
    shirt: '#F0ECE4',
    tie: '#7DA88B',
    skin: '#BD8A67',
    hair: '#1A1A1E',
    accent: '#7DA88B',
    prop: 'mic',
  },
  studio: {
    bgTop: '#141318',
    bgBottom: '#08080A',
    suit: '#1E1D24',
    shirt: '#EFECE6',
    tie: '#C9A96E',
    skin: '#C89B7B',
    hair: '#1E1B20',
    accent: '#C9A96E',
    prop: 'mic',
  },
};

const EMOTION_LABELS = {
  neutral: 'STUDIO LIVE',
  laugh: 'AMUSED',
  shock: 'SURPRISED',
  roast: 'SHARP TAKE',
  applause: 'OVATION',
  think: 'CONSIDERING',
};

export function drawStudioAvatar(ctx, width, height, state) {
  const {
    avatarStyle = 'glam',
    emotion = 'neutral',
    mouthOpen = 0,
    isSpeaking = false,
    tick = 0,
  } = state;

  const palette = THEME_PALETTES[avatarStyle] || THEME_PALETTES.glam;

  // 1. Editorial Studio Backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Architectural Acoustic Slat Lines
  ctx.strokeStyle = 'rgba(245, 242, 235, 0.032)';
  ctx.lineWidth = 1;
  for (let x = 32; x < width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 2. Restrained Rim Spotlight
  const cx = width * 0.5;
  const cy = height * 0.37;
  const haloRadius = width * (0.31 + mouthOpen * 0.03);
  const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, haloRadius);
  halo.addColorStop(0, `${palette.accent}28`);
  halo.addColorStop(0.55, `${palette.accent}0A`);
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  // 3. Minimal Broadcast Audio Meter Bars
  const barCount = 18;
  const barW = 4;
  const gap = 14;
  const totalBarsW = barCount * (barW + gap);
  const startX = (width - totalBarsW) / 2;
  ctx.fillStyle = `${palette.accent}52`;
  for (let i = 0; i < barCount; i++) {
    const wave = isSpeaking
      ? Math.abs(Math.sin(tick * 0.16 + i * 0.6)) * (10 + mouthOpen * 36)
      : 4 + Math.abs(Math.sin(tick * 0.035 + i * 0.45)) * 5;
    ctx.beginPath();
    ctx.roundRect(startX + i * (barW + gap), height * 0.41 - wave / 2, barW, wave, 2);
    ctx.fill();
  }

  const bobY = Math.sin(tick * 0.04) * 2.0 + (isSpeaking ? -mouthOpen * 2.2 : 0);

  // 4. Studio Chair Silhouette
  ctx.fillStyle = '#141418';
  ctx.beginPath();
  ctx.roundRect(width * 0.2, height * 0.56, width * 0.6, height * 0.44, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 242, 235, 0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 5. Tailored Suit & Collar
  ctx.save();
  ctx.translate(cx, height * 0.72 + bobY * 0.45);
  ctx.fillStyle = palette.suit;
  ctx.beginPath();
  ctx.moveTo(-110, 72);
  ctx.quadraticCurveTo(-102, -24, -30, -36);
  ctx.lineTo(30, -36);
  ctx.quadraticCurveTo(102, -24, 110, 72);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.shirt;
  ctx.beginPath();
  ctx.moveTo(-24, -36);
  ctx.lineTo(0, 34);
  ctx.lineTo(24, -36);
  ctx.closePath();
  ctx.fill();

  if (palette.tie) {
    ctx.fillStyle = palette.tie;
    ctx.beginPath();
    ctx.moveTo(-7, -30);
    ctx.lineTo(7, -30);
    ctx.lineTo(4.5, 34);
    ctx.lineTo(0, 42);
    ctx.lineTo(-4.5, 34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 6. Neck & Head
  const headX = cx;
  const headY = height * 0.365 + bobY;

  ctx.fillStyle = palette.skin;
  ctx.fillRect(headX - 16, headY + 46, 32, 38);

  ctx.beginPath();
  ctx.arc(headX - 54, headY + 6, 11, 0, Math.PI * 2);
  ctx.arc(headX + 54, headY + 6, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(headX, headY, 53, 65, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.ellipse(headX, headY - 38, 55, 30, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (avatarStyle === 'anime') {
    ctx.beginPath();
    ctx.moveTo(headX - 52, headY - 32);
    ctx.lineTo(headX - 33, headY - 72);
    ctx.lineTo(headX - 14, headY - 46);
    ctx.lineTo(headX + 5, headY - 78);
    ctx.lineTo(headX + 24, headY - 44);
    ctx.lineTo(headX + 44, headY - 70);
    ctx.lineTo(headX + 53, headY - 32);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(headX - 54, headY - 22);
    ctx.quadraticCurveTo(headX - 8, headY - 70, headX + 54, headY - 22);
    ctx.quadraticCurveTo(headX, headY - 46, headX - 54, headY - 22);
    ctx.fill();
  }

  if (palette.beard) {
    ctx.fillStyle = palette.hair;
    ctx.beginPath();
    ctx.ellipse(headX, headY + 32, 40, 30, 0, 0, Math.PI);
    ctx.fill();
  }

  // 7. Eyes & Brows
  const blink = tick % 180 > 174;
  const browLift = emotion === 'shock' ? -6 : emotion === 'roast' ? 3 : 0;

  ctx.strokeStyle = '#191616';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headX - 32, headY - 16 + browLift);
  ctx.lineTo(headX - 11, headY - 18 + (emotion === 'roast' ? 4 : browLift));
  ctx.moveTo(headX + 11, headY - 18 + (emotion === 'roast' ? 4 : browLift));
  ctx.lineTo(headX + 32, headY - 16 + browLift);
  ctx.stroke();

  if (palette.shades) {
    ctx.fillStyle = '#090A0D';
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(headX - 40, headY - 11, 34, 18, 4);
    ctx.roundRect(headX + 6, headY - 11, 34, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY - 3);
    ctx.lineTo(headX + 6, headY - 3);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#151417';
    if (blink || emotion === 'laugh') {
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(headX - 21, headY - 2, 8.5, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(headX + 21, headY - 2, 8.5, Math.PI, Math.PI * 2);
      ctx.stroke();
    } else {
      const eyeR = emotion === 'shock' ? 6.2 : 5;
      ctx.beginPath();
      ctx.arc(headX - 21, headY - 2, eyeR, 0, Math.PI * 2);
      ctx.arc(headX + 21, headY - 2, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F5F2EB';
      ctx.beginPath();
      ctx.arc(headX - 19, headY - 3.8, 1.7, 0, Math.PI * 2);
      ctx.arc(headX + 23, headY - 3.8, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (palette.glasses) {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(headX - 36, headY - 12, 29, 20, 4);
      ctx.roundRect(headX + 7, headY - 12, 29, 20, 4);
      ctx.moveTo(headX - 7, headY - 2);
      ctx.lineTo(headX + 7, headY - 2);
      ctx.stroke();
    }
  }

  if (palette.headphones) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(headX, headY - 4, 59, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#141418';
    ctx.beginPath();
    ctx.roundRect(headX - 66, headY - 13, 14, 34, 5);
    ctx.roundRect(headX + 52, headY - 13, 14, 34, 5);
    ctx.fill();
  }

  // 8. Lip-synced Mouth
  const openHeight = 3.5 + mouthOpen * 20 + (emotion === 'laugh' ? 5 : 0);
  const mouthW = emotion === 'shock' ? 11 : 19 + mouthOpen * 5;
  ctx.fillStyle = '#361A1D';
  ctx.beginPath();
  ctx.ellipse(headX, headY + 30, mouthW, Math.max(2.6, openHeight * 0.52), 0, 0, Math.PI * 2);
  ctx.fill();

  if (openHeight > 9) {
    ctx.fillStyle = '#F5F2EB';
    ctx.beginPath();
    ctx.roundRect(headX - mouthW * 0.52, headY + 25, mouthW * 1.04, 3.5, 1.5);
    ctx.fill();
  }

  // 9. Broadcast Boom Mic Silhouette
  const micX = cx - 96;
  const micY = height * 0.72;
  ctx.strokeStyle = '#3F3E45';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(micX - 24, height);
  ctx.lineTo(micX, micY);
  ctx.stroke();
  ctx.fillStyle = '#25252C';
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(micX - 9, micY - 22, 18, 28, 7);
  ctx.fill();
  ctx.stroke();

  // 10. Top-Right Editorial State Indicator (No Emojis)
  const labelText = EMOTION_LABELS[emotion] || EMOTION_LABELS.neutral;
  ctx.font = '600 11px Inter, sans-serif';
  const tw = ctx.measureText(labelText).width;
  ctx.fillStyle = 'rgba(7, 7, 9, 0.8)';
  ctx.beginPath();
  ctx.roundRect(width - tw - 32, 12, tw + 20, 24, 4);
  ctx.fill();
  ctx.strokeStyle = `${palette.accent}66`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#F5F2EB';
  ctx.fillText(labelText, width - tw - 22, 28);
}
