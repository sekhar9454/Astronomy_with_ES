import React, { useMemo } from 'react';

const StarsBackground = () => {
  const numberOfStars = 60;
  const starColors = ['#00b4ff', '#ffffff'];

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
      <style>
        {`
          .stars-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background-color: #080e1a;
            overflow: hidden;
            z-index: -1;
          }
          .star {
            position: absolute;
            border-radius: 50%;
            animation: moveUpward linear infinite;
          }
          @keyframes moveUpward {
            from {
              transform: translateY(100vh);
            }
            to {
              transform: translateY(-100vh);
            }
          }
        `}
      </style>
      <div className="stars-container">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              backgroundColor: star.color,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default StarsBackground;

