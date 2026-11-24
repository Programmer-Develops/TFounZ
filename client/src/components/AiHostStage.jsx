import React, { useEffect, useRef } from 'react';
import { drawStudioAvatar } from '../utils/canvasAvatarDrawer';

export default function AiHostStage({
  avatarStyle = 'glam',
  hostName = 'Karan AI',
  aiRole = 'host',
  tagline = 'AI Talk Show Host',
  emotion = 'neutral',
  lowerThirdText = 'LIVE ON TFOUNZ STUDIO',
  isSpeaking = false,
  analyserNode = null,
  externalCanvasRef = null,
}) {
  const internalRef = useRef(null);
  const canvasRef = externalCanvasRef || internalRef;

  useEffect(() => {
    let rafId = null;
    let tick = 0;
    const freqData = new Uint8Array(64);

    const renderFrame = () => {
      tick += 1;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        let mouthOpen = 0;

        if (analyserNode && isSpeaking) {
          analyserNode.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < 24; i++) sum += freqData[i];
          const avg = sum / 24;
          mouthOpen = avg > 6 ? Math.min(1, Math.max(0.1, (avg - 8) / 90)) : 0.25 + Math.abs(Math.sin(tick * 0.27)) * 0.45;
        } else if (isSpeaking) {
          mouthOpen = 0.28 + Math.abs(Math.sin(tick * 0.27)) * 0.58;
        } else {
          mouthOpen = 0.03;
        }

        drawStudioAvatar(ctx, canvas.width, canvas.height, {
          avatarStyle,
          hostName,
          aiRole,
          emotion,
          mouthOpen,
          isSpeaking,
          tick,
        });
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [avatarStyle, hostName, aiRole, emotion, isSpeaking, analyserNode, canvasRef]);

  const roleBadge =
    aiRole === 'guest' ? 'AI GUEST' : aiRole === 'co-host' ? 'AI CO-HOST' : 'AI HOST';

  return (
    <div className="stage-frame">
      <canvas ref={canvasRef} width={640} height={400} />

      <div className="stage-overlay-top">
        <span className="badge badge-live">
          <span className="pulse-dot" /> ON AIR • {roleBadge}
        </span>
      </div>

      <div className="stage-chyron">
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--accent-gold)',
            letterSpacing: '0.06em',
          }}
        >
          {hostName} • {tagline}
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginTop: 2 }}>
          {lowerThirdText}
        </div>
      </div>
    </div>
  );
}
