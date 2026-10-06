import React, { useState, useEffect } from 'react';

const BackToTop = () => {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowButton(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!showButton) return null;

  return (
    <>
      <style>
        {`
          .back-to-top-container {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            margin-right: 1rem;
            z-index: 1000;
          }
          .go-up-button {
            background: rgba(234, 94, 19, 0.8);
          }
          .go-up-button:hover {
            background: rgba(255, 111, 30, 0.9);
            transform: scale(1.1);
          }
        `}
      </style>
      <div className="back-to-top-container">
        <button
          className="action-button go-up-button"
          onClick={scrollToTop}
          title="Back to top"
        >
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>
    </>
  );
};

export default BackToTop;

