import React, { useEffect } from 'react';

const POPOVER_BTN =
  'flex cursor-pointer items-center gap-[0.4rem] rounded border-none px-3 py-2 text-base text-white transition-all duration-200 hover:scale-105';

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
      <div className="fixed inset-0 z-[1000] flex animate-fade-in items-center justify-center bg-black/90" onClick={onClose}>
        <div className="relative max-h-screen max-w-[90vw] animate-scale-in pt-12" onClick={(e) => e.stopPropagation()}>
          <div className="absolute top-0 right-0 z-[1] flex gap-2">
            {onDelete && imageId && (
              <button
                className={`${POPOVER_BTN} bg-[#dc2626]/85 hover:bg-[#ef4444]`}
                onClick={(e) => onDelete(imageId, imageTitle, e)}
                title="Delete APOD Record"
              >
                <i className="fas fa-trash-alt"></i> Delete
              </button>
            )}
            <button
              className={`${POPOVER_BTN} bg-accent/80 hover:bg-accent-hover/90`}
              onClick={onClose}
              title="Close"
            >
              <i className="fas fa-times"></i> Close
            </button>
          </div>
          <img
            src={imageUrl}
            alt={imageTitle || 'APOD Full View'}
            className="max-h-[90vh] max-w-full border-2 border-primary object-contain shadow-[0_0_1.25rem_rgba(234,94,19,0.3)]"
          />
        </div>
      </div>
    </>
  );
};

export default ImagePopover;

