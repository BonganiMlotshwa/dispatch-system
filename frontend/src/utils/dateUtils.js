/**
 * Date and time utility functions
 */

/**
 * Format days into a human-readable format (days/weeks/months/years)
 * @param {number} days - Number of days
 * @returns {string} - Formatted string
 */
export const formatDaysToHumanReadable = (days) => {
  // Handle null, undefined, or 0
  if (!days || days === 0 || isNaN(days)) return '0 days';
  
  const absdays = Math.abs(Math.floor(days)); // Ensure we work with positive integers
  
  // Less than 7 days - show days
  if (absdays < 7) {
    return `${absdays} day${absdays !== 1 ? 's' : ''}`;
  }
  
  // Less than 30 days - show weeks and days
  if (absdays < 30) {
    const weeks = Math.floor(absdays / 7);
    const remainingDays = absdays % 7;
    
    if (remainingDays === 0) {
      return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else {
      return `${weeks} week${weeks !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
  }
  
  // Less than 365 days - show months and weeks/days
  if (absdays < 365) {
    const months = Math.floor(absdays / 30);
    const remainingDays = absdays % 30;
    
    if (remainingDays === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else if (remainingDays < 7) {
      return `${months} month${months !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    } else {
      const weeks = Math.floor(remainingDays / 7);
      const extraDays = remainingDays % 7;
      if (extraDays === 0) {
        return `${months} month${months !== 1 ? 's' : ''}, ${weeks} week${weeks !== 1 ? 's' : ''}`;
      } else {
        return `${months} month${months !== 1 ? 's' : ''}, ${weeks} week${weeks !== 1 ? 's' : ''}`;
      }
    }
  }
  
  // 365+ days - show years and months
  const years = Math.floor(absdays / 365);
  const remainingDays = absdays % 365;
  
  if (remainingDays === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  } else if (remainingDays < 30) {
    return `${years} year${years !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  } else {
    const months = Math.floor(remainingDays / 30);
    return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
  }
};

/**
 * Get badge color based on time in warehouse
 * @param {number} days - Number of days in warehouse
 * @returns {string} - Bootstrap badge color
 */
export const getDaysBadgeColor = (days) => {
  if (days <= 7) return 'success';      // Green for 1 week or less
  if (days <= 30) return 'info';        // Blue for 1 month or less
  if (days <= 90) return 'warning';     // Yellow for 3 months or less
  return 'danger';                      // Red for more than 3 months
};

/**
 * Format date to local string with options
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Calculate days between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date (defaults to today)
 * @returns {number} - Number of days
 */
export const daysBetween = (startDate, endDate = new Date()) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};