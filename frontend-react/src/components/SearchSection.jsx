import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PaginationBar from './PaginationBar';
import CreatePlanetModal from './CreatePlanetModal';
import galaxyLogo from '../assets/galaxy_logo_white.svg';
import { MEDIUM_TEXT, SMALL_TEXT } from '../styles/text';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Maps tokenizer dropdown labels to the values the backend expects
const TOKENIZER_PARAMS = { Standard: 'standard', 'N-Gram': 'n_gram' };

const SearchSection = ({ onSearchResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPages, setMaxPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [noResultsFound, setNoResultsFound] = useState(false);
  const [yearOptions, setYearOptions] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSearchMethod, setSelectedSearchMethod] = useState('Regular search');
  const [selectedTokenizer, setSelectedTokenizer] = useState('Standard');
  const [loading, setLoading] = useState(false);
  const [showPlanetModal, setShowPlanetModal] = useState(false);

  const fetchYearCounts = useCallback(async (query, tokenizer) => {
    if (!query.trim()) {
      setYearOptions([]);
      return;
    }
    try {
      const endpoint = `${API_BASE_URL}/api/v1/get_docs_per_year_count?search_query=${encodeURIComponent(
        query.trim()
      )}&tokenizer=${TOKENIZER_PARAMS[tokenizer]}`;
      const res = await axios.get(endpoint);
      const docsPerYear = res.data?.docs_per_year || res.data?.year_counts || {};
      const formatted = Object.entries(docsPerYear).map(
        ([year, count]) => `${year} (${count})`
      );
      setYearOptions(formatted);
    } catch (err) {
      console.warn('Failed to fetch year counts:', err);
    }
  }, []);

  const performSearch = useCallback(
    async (query, page, size, yearVal, method, tokenizer) => {
      if (!query.trim()) {
        onSearchResults({ results: [], timestamp: Date.now() });
        setNoResultsFound(false);
        setErrorMessage('');
        return;
      }

      setLoading(true);
      setErrorMessage('');

      const skip = (page - 1) * size;
      const pureYear = yearVal ? yearVal.slice(0, 4) : '';
      let endpoint = '';

      if (method === 'Semantic search') {
        endpoint = `${API_BASE_URL}/api/v1/semantic_search?search_query=${encodeURIComponent(
          query.trim()
        )}&skip=${skip}&limit=${size}&year=${pureYear}`;
      } else {
        endpoint = `${API_BASE_URL}/api/v1/regular_search?search_query=${encodeURIComponent(
          query.trim()
        )}&skip=${skip}&limit=${size}&year=${pureYear}&tokenizer=${TOKENIZER_PARAMS[tokenizer]}`;
      }

      try {
        const response = await axios.get(endpoint);
        const hits = response.data?.hits || response.data?.documents || [];
        const calculatedMaxPages = response.data?.max_pages || Math.max(1, Math.ceil((response.data?.total || 1) / size));

        setMaxPages(calculatedMaxPages);
        setNoResultsFound(hits.length === 0);
        onSearchResults({ results: hits, timestamp: Date.now() });
      } catch (error) {
        console.error('Search error:', error);
        setErrorMessage(
          error.response?.data?.message ||
            (typeof error.response?.data === 'string' ? error.response?.data : '') ||
            'Unable to fetch results. Check your backend/database connection.'
        );
      } finally {
        setLoading(false);
      }
    },
    [onSearchResults]
  );

  // Trigger search on parameter changes
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(
        searchQuery,
        currentPage,
        pageSize,
        selectedYear,
        selectedSearchMethod,
        selectedTokenizer
      );
    } else {
      onSearchResults({ results: [], timestamp: Date.now() });
      setNoResultsFound(false);
    }
  }, [
    searchQuery,
    currentPage,
    pageSize,
    selectedYear,
    selectedSearchMethod,
    selectedTokenizer,
    performSearch,
    onSearchResults,
  ]);

  // Update year breakdown on load and when query or tokenizer changes
  useEffect(() => {
    if (searchQuery.trim()) {
      fetchYearCounts(searchQuery, selectedTokenizer);
    } else {
      setYearOptions([]);
    }
  }, [searchQuery, selectedTokenizer, fetchYearCounts]);

  const handleQueryChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearchQuery('');
    setCurrentPage(1);
    setSelectedYear(null);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const handleMethodChange = (method) => {
    setSelectedSearchMethod(method);
    setCurrentPage(1);
  };

  const handleTokenizerChange = (tok) => {
    setSelectedTokenizer(tok);
    setSelectedYear(null);
    setCurrentPage(1);
  };

  const canShowPagination = searchQuery.trim().length > 0 && !errorMessage;

  return (
    <>
      <div className="mt-16 flex w-full flex-col items-center sm:mt-24 lg:mt-32 2xl:mt-40">
        <a href="/" className="mb-12 block w-18 sm:w-28 lg:mb-20 lg:w-40 2xl:mb-32 2xl:w-60">
          <img
            src={galaxyLogo}
            className="block w-full"
            alt="My Universe Hub logo"
          />
        </a>

        <button
          className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-[20px] border border-accent/60 bg-linear-135 from-accent/20 to-accent/40 px-5 py-[0.6rem] text-base font-semibold text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:from-accent hover:to-[#ff8c00] hover:shadow-[0_0_15px_rgba(234,94,19,0.5)]"
          onClick={() => setShowPlanetModal(true)}
        >
          <i className="fas fa-plus-circle"></i> Add Planet Record
        </button>

        {errorMessage && (
          <div className={`mb-2 self-start pl-2 text-[rgb(255,80,80)] ${SMALL_TEXT}`}>{errorMessage}</div>
        )}

        <div className="relative inline-block w-full">
          <input
            className="h-14 w-full rounded-none border-2 border-accent/30 bg-white/8 pr-16 pl-6 text-[1.1rem] text-white outline-none transition-colors duration-300 focus:border-primary lg:h-16 lg:text-xl 2xl:h-24 2xl:text-[1.75rem]"
            type="text"
            value={searchQuery}
            onChange={handleQueryChange}
            placeholder="Search astronomy images or planets, e.g. Kepler, Andromeda..."
          />
          <div className="absolute top-1/2 right-6 flex -translate-y-1/2 items-center gap-3">
            {loading && <i className={`fas fa-spinner fa-spin text-accent ${SMALL_TEXT}`}></i>}
            {searchQuery && (
              <button
                className="flex cursor-pointer items-center border-none bg-none text-[1.8rem] text-primary transition-colors duration-300 hover:text-white 2xl:text-[2.5rem]"
                onClick={handleClear}
                title="Clear search"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>

        <CreatePlanetModal
          show={showPlanetModal}
          onClose={() => setShowPlanetModal(false)}
          onPlanetCreated={(newPlanet) => {
            if (searchQuery.trim()) {
              performSearch(
                searchQuery,
                currentPage,
                pageSize,
                selectedYear,
                selectedSearchMethod,
                selectedTokenizer
              );
            }
          }}
        />

        {canShowPagination && (
          <PaginationBar
            currentPage={currentPage}
            maxPages={maxPages}
            yearOptions={yearOptions}
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
            selectedSearchMethod={selectedSearchMethod}
            onSearchMethodChange={handleMethodChange}
            selectedTokenizer={selectedTokenizer}
            onTokenizerChange={handleTokenizerChange}
            selectedPageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={handlePageChange}
          />
        )}

        {noResultsFound && !loading && (
          <div className={`mt-8 text-center text-[#aaa] ${MEDIUM_TEXT}`}>
            <i className="fas fa-search mr-2"></i>No results found.
          </div>
        )}
      </div>
    </>
  );
};

export default SearchSection;

