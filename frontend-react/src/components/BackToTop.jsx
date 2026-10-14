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
      <div className="fixed right-4 bottom-4 z-[1000] mr-4">
        <button
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-accent/80 backdrop-blur-[5px] transition-all duration-300 hover:scale-110 hover:bg-accent-hover/90"
          onClick={scrollToTop}
          title="Back to top"
        >
          <i className="fas fa-arrow-up text-base text-white"></i>
        </button>
      </div>
    </>
  );
};

export default BackToTop;

