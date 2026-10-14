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
      <div className="flex flex-col items-center mx-4 xs:mx-8 sm:mx-12 lg:mx-20 xl:mx-48 2xl:mx-80">
        <SearchSection onSearchResults={setSearchResults} />
        <GallerySection searchResults={searchResults} />
        <BackToTop />
      </div>
    </>
  );
}

export default App;

