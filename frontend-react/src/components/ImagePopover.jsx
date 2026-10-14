import React, { useEffect } from 'react';

const ImagePopover = ({ show, imageUrl, imageTitle, imageId, onDelete, onClose }) => {
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
            gap: 0.5rem;
            z-index: 1;
          }
          .popover-btn {
            background: rgba(234, 94, 19, 0.8);
            border: none;
            color: white;
            padding: 0.5rem 0.75rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            transition: all 0.2s ease;
          }
          .popover-btn:hover {
            transform: scale(1.05);
          }
          .delete-btn-popover {
            background: rgba(220, 38, 38, 0.85);
          }
          .delete-btn-popover:hover {
            background: rgba(239, 68, 68, 1);
          }
          .close-button {
            background: rgba(234, 94, 19, 0.8);
          }
          .close-button:hover {
            background: rgba(255, 111, 30, 0.9);
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
            {onDelete && imageId && (
              <button
                className="popover-btn delete-btn-popover"
                onClick={(e) => onDelete(imageId, imageTitle, e)}
                title="Delete APOD Record"
              >
                <i className="fas fa-trash-alt"></i> Delete
              </button>
            )}
            <button
              className="popover-btn close-button"
              onClick={onClose}
              title="Close"
            >
              <i className="fas fa-times"></i> Close
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

