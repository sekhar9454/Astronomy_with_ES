import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PaginationBar from './PaginationBar';
import CreatePlanetModal from './CreatePlanetModal';
import galaxyLogo from '../assets/galaxy_logo_white.svg';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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
      )}&tokenizer=${tokenizer}`;
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
        )}&skip=${skip}&limit=${size}&year=${pureYear}&tokenizer=${tokenizer}`;
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
      <style>
        {`
          .search-header-container {
            margin-top: 10rem;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .image-logo-container {
            display: block;
            width: 15rem;
            margin-bottom: 8rem;
          }
          .image-logo {
            display: block;
            width: 100%;
          }
          .search-input-wrapper {
            width: 100%;
            position: relative;
            display: inline-block;
          }
          .input-text-field {
            width: 100%;
            height: 6rem;
            border-radius: 0;
            background: rgba(255, 255, 255, 0.08);
            border: 2px solid rgba(234, 94, 19, 0.3);
            color: #fff;
            padding: 0 4rem 0 1.5rem;
            font-size: 1.75rem;
            outline: none;
            transition: border-color 0.3s;
          }
          .input-text-field:focus {
            border-color: var(--primary-color);
          }
          .icon-actions {
            position: absolute;
            right: 1.5rem;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            gap: 0.75rem;
            align-items: center;
          }
          .clear-icon-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--primary-color);
            transition: color 0.3s ease;
            font-size: 2.5rem;
            display: flex;
            align-items: center;
          }
          .clear-icon-btn:hover {
            color: #fff;
          }
          .error-msg {
            margin-bottom: 0.5rem;
            color: rgb(255, 80, 80);
            padding-left: 0.5rem;
            align-self: flex-start;
          }
          .no-results-msg {
            margin-top: 2rem;
            text-align: center;
            color: #aaa;
          }
          .no-results-msg i {
            margin-right: 0.5rem;
          }
          @media screen and (max-width: 1920px) {
            .search-header-container { margin-top: 8rem; }
            .image-logo-container { width: 10rem; margin-bottom: 5rem; }
            .input-text-field { height: 4rem; font-size: 1.25rem; }
            .clear-icon-btn { font-size: 1.8rem; }
          }
          @media screen and (max-width: 992px) {
            .search-header-container { margin-top: 6rem; }
            .image-logo-container { width: 7rem; margin-bottom: 3rem; }
            .input-text-field { height: 3.5rem; font-size: 1.1rem; }
          }
          @media screen and (max-width: 576px) {
            .search-header-container { margin-top: 4rem; }
            .image-logo-container { width: 4.5rem; }
          .add-planet-btn {
            margin-bottom: 1.5rem;
            background: linear-gradient(135deg, rgba(234, 94, 19, 0.2) 0%, rgba(234, 94, 19, 0.4) 100%);
            border: 1px solid rgba(234, 94, 19, 0.6);
            color: #fff;
            padding: 0.6rem 1.25rem;
            border-radius: 20px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.25s ease;
          }
          .add-planet-btn:hover {
            background: linear-gradient(135deg, #ea5e13 0%, #ff8c00 100%);
            box-shadow: 0 0 15px rgba(234, 94, 19, 0.5);
            transform: translateY(-2px);
          }
        `}
      </style>
      <div className="search-header-container">
        <a href="/" className="image-logo-container">
          <img
            src={galaxyLogo}
            className="image-logo"
            alt="My Universe Hub logo"
          />
        </a>

        <button
          className="add-planet-btn"
          onClick={() => setShowPlanetModal(true)}
        >
          <i className="fas fa-plus-circle"></i> Add Planet Record
        </button>

        {errorMessage && (
          <div className="error-msg small-text">{errorMessage}</div>
        )}

        <div className="search-input-wrapper">
          <input
            className="input-text-field"
            type="text"
            value={searchQuery}
            onChange={handleQueryChange}
            placeholder="Search astronomy images or planets, e.g. Kepler, Andromeda..."
          />
          <div className="icon-actions">
            {loading && <i className="fas fa-spinner fa-spin small-text" style={{ color: '#ea5e13' }}></i>}
            {searchQuery && (
              <button
                className="clear-icon-btn"
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
          <div className="no-results-msg medium-text">
            <i className="fas fa-search"></i> No results found.
          </div>
        )}
      </div>
    </>
  );
};

export default SearchSection;

