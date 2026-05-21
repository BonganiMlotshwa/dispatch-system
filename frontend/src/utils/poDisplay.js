/**
 * Display helpers for customer vs internal PO numbers.
 */

export function getCustomerPoPrefix(customer) {
  if (customer === 'MRP') return 'FTM-';
  if (customer === 'OTB') return 'OTTO-';
  return `${customer}-`;
}

export function formatCustomerPoDisplay(customer, poNumber) {
  if (poNumber === null || poNumber === undefined || poNumber === '') {
    return 'N/A';
  }
  const po = String(poNumber).trim();
  if (/^[A-Za-z]+-/.test(po)) {
    return po;
  }
  return `${getCustomerPoPrefix(customer || '')}${po}`;
}

export function isOtbCustomer(customer) {
  const c = String(customer || '').toUpperCase();
  return c === 'OTB' || c === 'OTTO';
}

/** FTM PO = internal_po_number, always shown as FTM-##### */
export function formatFtmInternalPo(internalPoNumber) {
  if (internalPoNumber === null || internalPoNumber === undefined || internalPoNumber === '') {
    return 'N/A';
  }
  const po = String(internalPoNumber).trim();
  if (/^FTM-/i.test(po)) {
    return `FTM-${po.replace(/^FTM-/i, '')}`;
  }
  const m = po.match(/^[A-Za-z]+-(.+)$/);
  if (m) return `FTM-${m[1]}`;
  return `FTM-${po}`;
}
