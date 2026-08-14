import React, { useState, useMemo, useEffect } from 'react';
import { ModernCard } from './ModernCard';

export const ModernTable = ({ 
  data = [], 
  columns = [], 
  loading = false,
  searchable = true,
  sortable = true,
  pagination = true,
  pageSize = 10,
  className = '',
  emptyMessage = 'No data available',
  ...props 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [data, searchTerm]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(row =>
      columns.some(column => {
        const value = column.accessor ? row[column.accessor] : '';
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      })
    );
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key) => {
    if (!sortable) return;
    
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (!pagination || totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    pages.push(
      <button
        key="prev"
        className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <i className="bi bi-chevron-left"></i>
      </button>
    );

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Next button
    pages.push(
      <button
        key="next"
        className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <i className="bi bi-chevron-right"></i>
      </button>
    );

    return (
      <div className="table-pagination">
        <div className="pagination-info">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
        </div>
        <div className="pagination-controls">
          {pages}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <ModernCard className={`modern-table-container ${className}`}>
        <div className="table-header">
          <div className="loading-skeleton-line" style={{ width: '200px', height: '2rem' }}></div>
          <div className="loading-skeleton-line" style={{ width: '300px', height: '2.5rem' }}></div>
        </div>
        <div className="table-loading">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="loading-skeleton-row">
              {columns.map((_, colIndex) => (
                <div key={colIndex} className="loading-skeleton-line"></div>
              ))}
            </div>
          ))}
        </div>
      </ModernCard>
    );
  }

  return (
    <ModernCard className={`modern-table-container ${className}`} padding="none" {...props}>
      {(searchable || columns.some(col => col.actions)) && (
        <div className="table-header">
          <div className="table-title">
            <h5>Data Table</h5>
            <span className="table-count">{sortedData.length} entries</span>
          </div>
          
          {searchable && (
            <div className="table-search">
              <div className="search-input-container">
                <i className="bi bi-search search-icon"></i>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`${sortable && column.sortable !== false ? 'sortable' : ''} ${
                    sortConfig.key === column.accessor ? `sorted-${sortConfig.direction}` : ''
                  }`}
                  onClick={() => column.sortable !== false && handleSort(column.accessor)}
                  style={{ width: column.width }}
                >
                  <div className="th-content">
                    <span>{column.header}</span>
                    {sortable && column.sortable !== false && (
                      <div className="sort-icons">
                        <i className="bi bi-chevron-up"></i>
                        <i className="bi bi-chevron-down"></i>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  <div className="empty-state-content">
                    <i className="bi bi-inbox empty-state-icon"></i>
                    <p className="empty-state-message">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="table-row">
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className={column.className || ''}>
                      {column.render 
                        ? column.render(row[column.accessor], row, rowIndex)
                        : row[column.accessor]
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {renderPagination()}
    </ModernCard>
  );
};