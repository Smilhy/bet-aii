import React, { useEffect, useState } from 'react';
import banner from '../public/dashboard-hero-v551/bet_ai_ultra_pro_nowy_tip.gif';

export default function TipAlert({ visible, username }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      pointerEvents: 'none'
    }}>
      <div style={{ textAlign: 'center', animation: 'fadeIn .3s ease' }}>
        <img
          src={banner}
          alt="Tip Alert"
          style={{ width: 420, maxWidth: '90vw', borderRadius: 24 }}
        />
        <div style={{
          marginTop: 12,
          fontSize: 28,
          fontWeight: 800,
          color: '#00d5ff',
          textShadow: '0 0 20px #00d5ff'
        }}>
          TIP OD: {username}
        </div>
      </div>
    </div>
  );
}
