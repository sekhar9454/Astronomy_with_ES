import React, { useState } from 'react';
import StarsBackground from './components/StarsBackground';
import SearchSection from './components/SearchSection';
import GallerySection from './components/GallerySection';
import BackToTop from './components/BackToTop';

function App() {
  const [searchResults, setSearchResults] = useState({ results: [], timestamp: 0 });

  return (
    <>
      <StarsBackground />
      <div className="container">
        <SearchSection onSearchResults={setSearchResults} />
        <GallerySection searchResults={searchResults} />
        <BackToTop />
      </div>
    </>
  );
}

export default App;

