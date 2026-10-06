import React from 'react';

const PaginationBar = ({
  currentPage,
  maxPages,
  yearOptions = [],
  selectedYear,
  onYearChange,
  selectedSearchMethod,
  onSearchMethodChange,
  selectedTokenizer,
  onTokenizerChange,
  selectedPageSize,
  onPageSizeChange,
  onPageChange,
}) => {
  const pageSizes = [10, 20, 50];
  const searchMethods = ['Regular search', 'Semantic search'];
  const tokenizers = ['Standard', 'N-Gram'];

  return (
    <>
      <style>
        {`
          .pagination-bar-container {
            width: 100%;
            border: 1px solid rgba(234, 94, 19, 0.2);
            background: rgba(255, 255, 255, 0.05);
            padding: 1.5rem;
            margin-top: 2rem;
          }
          .pagination-bar-container .row {
            display: flex;
            gap: 1.25rem;
            flex-wrap: wrap;
            justify-content: space-between;
          }
          .filter-group {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
            flex-grow: 1;
          }
          .custom-select {
            border-radius: 0;
            height: 4rem;
            background: rgba(8, 14, 26, 0.8);
            border: 1px solid rgba(234, 94, 19, 0.3);
            color: white;
            width: 100%;
            padding: 0 1rem;
            font-size: 1.2rem;
            outline: none;
            cursor: pointer;
            transition: border-color 0.3s;
          }
          .custom-select:focus {
            border-color: var(--primary-color);
          }
          .custom-select option {
            background-color: #080e1a;
            color: white;
          }
          .pagination-buttons {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
            gap: 0.5rem;
            margin-top: 3rem;
          }
          .pagination-btn {
            background: transparent;
            height: 4rem;
            border: 1px solid rgba(234, 94, 19, 0.2);
            padding: 1rem 1.5rem;
            border-radius: 0;
            cursor: pointer;
            color: white;
            transition: background-color 0.3s ease, color 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .pagination-btn:disabled {
            cursor: not-allowed;
            color: #666;
            border-color: rgba(255, 255, 255, 0.1);
          }
          .pagination-btn:hover:not(:disabled) {
            background-color: rgba(234, 94, 19, 0.2);
            border-color: var(--primary-color);
          }
          .current-page {
            margin: 0 1.25rem;
            color: #fff;
          }
          @media screen and (max-width: 992px) {
            .custom-select {
              height: 3rem;
              font-size: 1rem;
            }
            .pagination-btn {
              height: 3rem;
              padding: 0.5rem 1rem;
            }
          }
          @media screen and (max-width: 576px) {
            .pagination-btn .button-text {
              display: none;
            }
            .pagination-buttons {
              margin-top: 1.5rem;
              justify-content: center;
            }
          }
        `}
      </style>
      <div className="pagination-bar-container">
        <div className="row">
          {/* Year Filter */}
          <div className="filter-group">
            <span className="medium-text">Year</span>
            <select
              className="custom-select"
              value={selectedYear || ''}
              onChange={(e) => onYearChange(e.target.value || null)}
              title="Filter by year"
            >
              <option value="">All years</option>
              {yearOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Search Method */}
          <div className="filter-group">
            <span className="medium-text">Search method</span>
            <select
              className="custom-select"
              value={selectedSearchMethod}
              onChange={(e) => onSearchMethodChange(e.target.value)}
              title="Change search method"
            >
              {searchMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Tokenizer */}
          {selectedSearchMethod === 'Regular search' && (
            <div className="filter-group">
              <span className="medium-text">Tokenizer</span>
              <select
                className="custom-select"
                value={selectedTokenizer}
                onChange={(e) => onTokenizerChange(e.target.value)}
                title="Change tokenizer"
              >
                {tokenizers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Page Size */}
          <div className="filter-group">
            <span className="medium-text">Items per page</span>
            <select
              className="custom-select"
              value={selectedPageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              title="Change items per page"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="pagination-buttons">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            className="pagination-btn medium-text"
            title="First page"
          >
            <i className="fas fa-angle-double-left"></i>
            <span className="button-text">First</span>
          </button>
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="pagination-btn medium-text"
            title="Previous page"
          >
            <i className="fas fa-chevron-left"></i>
            <span className="button-text">Previous</span>
          </button>

          <span className="current-page medium-text">
            {currentPage} / {maxPages || 1}
          </span>

          <button
            disabled={currentPage >= (maxPages || 1)}
            onClick={() => onPageChange(currentPage + 1)}
            className="pagination-btn medium-text"
            title="Next page"
          >
            <span className="button-text">Next</span>
            <i className="fas fa-chevron-right"></i>
          </button>
          <button
            disabled={currentPage >= (maxPages || 1)}
            onClick={() => onPageChange(maxPages)}
            className="pagination-btn medium-text"
            title="Last page"
          >
            <span className="button-text">Last</span>
            <i className="fas fa-angle-double-right"></i>
          </button>
        </div>
      </div>
    </>
  );
};

export default PaginationBar;

