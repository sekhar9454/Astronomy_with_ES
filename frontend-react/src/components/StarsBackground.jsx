import React, { useMemo } from 'react';

const StarsBackground = () => {
  const numberOfStars = 60;
  const starColors = ['bg-star-blue', 'bg-white'];

  const stars = useMemo(() => {
    return Array.from({ length: numberOfStars }, (_, index) => {
      const duration = Math.random() * 40 + 20;
      return {
        id: index,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.7,
        delay: -Math.random() * duration,
        duration: duration,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      };
    });
  }, []);

  return (
    <>
      <div className="fixed inset-0 -z-1 h-screen overflow-hidden bg-space">
        {stars.map((star) => (
          <div
            key={star.id}
            className={`absolute animate-star rounded-full ${star.color}`}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default StarsBackground;

