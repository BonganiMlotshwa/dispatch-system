/**
 * Utility functions for formatting data
 */

/**
 * Format a date string to a more readable format
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return dateString;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format a status string to a more readable format
 * @param {string} status - The status string to format
 * @returns {string} - The formatted status string
 */
export const formatStatus = (status) => formatCartonStatus(status);

/** Carton scan status labels (exited displays as Shipped). */
export const formatCartonStatus = (status) => {
  if (!status) return 'Unknown';
  switch (String(status).toLowerCase()) {
    case 'entered':
      return 'In Warehouse';
    case 'exited':
    case 'shipped':
      return 'Shipped';
    case 'pending':
      return 'Pending';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
};