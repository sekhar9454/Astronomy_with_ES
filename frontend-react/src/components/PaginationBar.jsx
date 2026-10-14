import React from 'react';
import { MEDIUM_TEXT } from '../styles/text';

const SELECT =
  'h-12 w-full cursor-pointer rounded-none border border-accent/30 bg-space/80 px-4 text-base text-white outline-none transition-colors duration-300 focus:border-primary lg:h-16 lg:text-[1.2rem] [&_option]:bg-space [&_option]:text-white';
const PAGE_BTN = `flex h-12 cursor-pointer items-center gap-2 rounded-none border border-accent/20 bg-transparent px-4 py-2 text-white transition-colors duration-300 enabled:hover:border-primary enabled:hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#666] lg:h-16 lg:px-6 lg:py-4 ${MEDIUM_TEXT}`;

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
      <div className="mt-8 w-full border border-accent/20 bg-white/5 p-6">
        <div className="flex flex-wrap justify-between gap-5">
          {/* Year Filter */}
          <div className="flex grow flex-col items-start gap-2">
            <span className={MEDIUM_TEXT}>Year</span>
            <select
              className={SELECT}
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
          <div className="flex grow flex-col items-start gap-2">
            <span className={MEDIUM_TEXT}>Search method</span>
            <select
              className={SELECT}
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
            <div className="flex grow flex-col items-start gap-2">
              <span className={MEDIUM_TEXT}>Tokenizer</span>
              <select
                className={SELECT}
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
          <div className="flex grow flex-col items-start gap-2">
            <span className={MEDIUM_TEXT}>Items per page</span>
            <select
              className={SELECT}
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
        <div className="mt-6 flex w-full items-center justify-center gap-2 sm:mt-12 sm:justify-end">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            className={PAGE_BTN}
            title="First page"
          >
            <i className="fas fa-angle-double-left"></i>
            <span className="hidden sm:inline">First</span>
          </button>
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className={PAGE_BTN}
            title="Previous page"
          >
            <i className="fas fa-chevron-left"></i>
            <span className="hidden sm:inline">Previous</span>
          </button>

          <span className={`mx-5 text-white ${MEDIUM_TEXT}`}>
            {currentPage} / {maxPages || 1}
          </span>

          <button
            disabled={currentPage >= (maxPages || 1)}
            onClick={() => onPageChange(currentPage + 1)}
            className={PAGE_BTN}
            title="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <i className="fas fa-chevron-right"></i>
          </button>
          <button
            disabled={currentPage >= (maxPages || 1)}
            onClick={() => onPageChange(maxPages)}
            className={PAGE_BTN}
            title="Last page"
          >
            <span className="hidden sm:inline">Last</span>
            <i className="fas fa-angle-double-right"></i>
          </button>
        </div>
      </div>
    </>
  );
};

export default PaginationBar;

