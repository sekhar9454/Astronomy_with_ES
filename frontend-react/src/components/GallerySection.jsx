import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ImagePopover from './ImagePopover';

const GallerySection = ({ searchResults }) => {
  const [imageLoaded, setImageLoaded] = useState({});
  const [showPopover, setShowPopover] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [localResults, setLocalResults] = useState([]);

  useEffect(() => {
    const rawResults = searchResults?.results || searchResults?.hits || searchResults?.documents || [];
    const seenKeys = new Set();
    const filtered = rawResults.filter((item) => {
      const source = item._source || item || {};
      const key = `${(source.title || '').trim().toLowerCase()}-${source.date || ''}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    setLocalResults(filtered);
  }, [searchResults]);

  const handleShowImage = (item) => {
    setSelectedImage(item);
    setShowPopover(true);
  };

  const handleClosePopover = () => {
    setShowPopover(false);
    setSelectedImage(null);
  };

  const handleDeleteDocument = async (docId, title, e) => {
    if (e) e.stopPropagation();
    if (!docId) {
      alert("Unable to delete: Missing document ID.");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete "${title || 'this APOD record'}"?`);
    if (!confirmed) return;

    try {
      await axios.delete(`/api/v1/documents/${docId}`);
      setLocalResults((prev) => prev.filter((item) => {
        const source = item._source || item || {};
        return source.id !== docId && item.id !== docId;
      }));
      if (selectedImage && selectedImage.id === docId) {
        handleClosePopover();
      }
      alert(`Record "${title || docId}" deleted successfully.`);
    } catch (err) {
      console.error('Delete document failed:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      alert(`Failed to delete record: ${errMsg}`);
    }
  };

  return (
    <>
      <div className="mt-4 mb-20 w-full">
        <div className="mx-auto grid grid-cols-1 gap-8 lg:grid-cols-2">
          {localResults.map((item, index) => {
            const source = item._source || item || {};
            const docId = source.id || item.id;
            const imageUrl = source.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop';
            const isLoaded = imageLoaded[index];
            return (
              <div
                key={`${docId || index}-${index}`}
                className="group relative overflow-hidden border border-accent/20 bg-white/5 transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_0.5rem_1.25rem_rgba(234,94,19,0.2)]"
              >
                {docId && (
                  <button
                    className="absolute top-4 right-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-[#dc2626]/85 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-200 hover:scale-115 hover:bg-[#ef4444]"
                    onClick={(e) => handleDeleteDocument(docId, source.title, e)}
                    title="Delete APOD Record"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
                <div className="flex flex-col items-stretch">
                  <div
                    className="relative min-h-[300px] w-full shrink-0 cursor-pointer overflow-hidden bg-white/5 lg:h-[500px]"
                    onClick={() => handleShowImage({ ...source, id: docId, image_url: imageUrl })}
                  >
                    {!isLoaded && <div className="absolute inset-0 animate-shimmer bg-linear-90 from-white/5 from-25% via-accent/10 via-50% to-white/5 to-75% bg-size-[200%_100%]"></div>}
                    <img
                      src={imageUrl}
                      alt={source.title || 'APOD Image'}
                      className={`h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() =>
                        setImageLoaded((prev) => ({ ...prev, [index]: true }))
                      }
                      onError={() =>
                        setImageLoaded((prev) => ({ ...prev, [index]: true }))
                      }
                    />
                  </div>
                  <div className="relative flex flex-col p-6">
                    <h2 className="mb-4 text-[2rem] font-bold text-primary">{source.title || 'Untitled'}</h2>
                    <p className="grow text-base leading-[1.75] text-white">{source.explanation || 'No description available.'}</p>
                    <span className="mt-4 self-end text-base text-white/70">{source.date || ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ImagePopover
          show={showPopover}
          imageUrl={selectedImage?.image_url}
          imageTitle={selectedImage?.title}
          imageId={selectedImage?.id}
          onDelete={handleDeleteDocument}
          onClose={handleClosePopover}
        />
      </div>
    </>
  );
};

export default GallerySection;

