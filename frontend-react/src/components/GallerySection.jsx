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
      <style>
        {`
          .gallery-container {
            width: 100%;
            margin-top: 1rem;
            margin-bottom: 5rem;
          }
          .gallery_grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem;
            margin: 0 auto;
          }
          .gallery_card {
            position: relative;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(234, 94, 19, 0.2);
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .gallery_card:hover {
            transform: translateY(-0.5rem);
            box-shadow: 0 0.5rem 1.25rem rgba(234, 94, 19, 0.2);
          }
          .card_content {
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }
          .image_container {
            position: relative;
            width: 100%;
            height: 500px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.05);
            cursor: pointer;
            flex-shrink: 0;
          }
          .card_image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
          }
          .card_image.image-loaded {
            opacity: 1;
          }
          .gallery_card:hover .card_image {
            transform: scale(1.05);
          }
          .card_delete_btn {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: rgba(220, 38, 38, 0.85);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          }
          .card_delete_btn:hover {
            background: rgba(239, 68, 68, 1);
            transform: scale(1.15);
          }
          .text_container {
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            position: relative;
          }
          .card_title {
            color: var(--primary-color);
            margin: 0 0 1rem 0;
            font-size: 2rem;
            font-weight: bold;
          }
          .card_description {
            color: #fff;
            margin: 0;
            line-height: 1.75;
            flex-grow: 1;
            font-size: 1rem;
          }
          .card_date {
            color: rgba(255, 255, 255, 0.7);
            font-size: 1rem;
            margin-top: 1rem;
            align-self: flex-end;
          }
          .image_loader {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05) 25%,
              rgba(234, 94, 19, 0.1) 50%,
              rgba(255, 255, 255, 0.05) 75%
            );
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
          }
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @media (max-width: 992px) {
            .gallery_grid {
              grid-template-columns: 1fr;
            }
            .image_container {
              height: auto;
              min-height: 300px;
            }
          }
        `}
      </style>
      <div className="gallery-container">
        <div className="gallery_grid">
          {localResults.map((item, index) => {
            const source = item._source || item || {};
            const docId = source.id || item.id;
            const imageUrl = source.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop';
            const isLoaded = imageLoaded[index];
            return (
              <div
                key={`${docId || index}-${index}`}
                className="gallery_card"
              >
                {docId && (
                  <button
                    className="card_delete_btn"
                    onClick={(e) => handleDeleteDocument(docId, source.title, e)}
                    title="Delete APOD Record"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
                <div className="card_content">
                  <div
                    className="image_container"
                    onClick={() => handleShowImage({ ...source, id: docId, image_url: imageUrl })}
                  >
                    {!isLoaded && <div className="image_loader"></div>}
                    <img
                      src={imageUrl}
                      alt={source.title || 'APOD Image'}
                      className={`card_image ${isLoaded ? 'image-loaded' : ''}`}
                      onLoad={() =>
                        setImageLoaded((prev) => ({ ...prev, [index]: true }))
                      }
                      onError={() =>
                        setImageLoaded((prev) => ({ ...prev, [index]: true }))
                      }
                    />
                  </div>
                  <div className="text_container">
                    <h2 className="card_title">{source.title || 'Untitled'}</h2>
                    <p className="card_description">{source.explanation || 'No description available.'}</p>
                    <span className="card_date">{source.date || ''}</span>
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

