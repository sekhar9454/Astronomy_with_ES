import React, { useEffect } from 'react';

const ImagePopover = ({ show, imageUrl, imageTitle, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      <style>
        {`
          .popover-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
          }
          .popover-content {
            position: relative;
            max-width: 90vw;
            max-height: 100vh;
            padding-top: 3rem;
            animation: scaleIn 0.3s ease;
          }
          .popover-image {
            max-width: 100%;
            max-height: 90vh;
            object-fit: contain;
            border: 2px solid var(--primary-color);
            box-shadow: 0 0 1.25rem rgba(234, 94, 19, 0.3);
          }
          .button-container {
            position: absolute;
            top: 0;
            right: 0;
            display: flex;
            z-index: 1;
          }
          .close-button {
            background: rgba(234, 94, 19, 0.8);
          }
          .close-button:hover {
            background: rgba(255, 111, 30, 0.9);
            transform: scale(1.1);
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
      <div className="popover-overlay" onClick={onClose}>
        <div className="popover-content" onClick={(e) => e.stopPropagation()}>
          <div className="button-container">
            <button
              className="action-button close-button"
              onClick={onClose}
              title="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <img
            src={imageUrl}
            alt={imageTitle || 'APOD Full View'}
            className="popover-image"
          />
        </div>
      </div>
    </>
  );
};

export default ImagePopover;

