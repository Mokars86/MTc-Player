import { useEffect, useState } from 'react';
import './SplashScreen.css';

export default function SplashScreen({ onComplete }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Start fading out after 2 seconds
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2000);

    // Completely remove splash screen after 2.5 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen-container ${isFading ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <img src="/mtc-logo-v5.png" alt="MTc Player Logo" className="splash-logo" />
      </div>
      
      <div className="splash-footer">
        <p>Develop by: Mokars Tech</p>
      </div>
    </div>
  );
}
