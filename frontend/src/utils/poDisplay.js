/**
 * Display helpers for customer vs internal PO numbers.
 */

export function getCustomerPoPrefix(customer) {
  if (customer === 'MRP') return 'FTM-';
  if (customer === 'OTB') return 'OTTO-';
  return `${customer}-`;
}

/** Internal / list PO prefix: OTB → OTTO-, MRP → FTM- */
export function getInternalPoPrefix(customer) {
  return getCustomerPoPrefix(customer);
}

export function formatCustomerPoDisplay(customer, poNumber) {
  if (poNumber === null || poNumber === undefined || poNumber === '') {
    return 'N/A';
  }
  const po = String(poNumber).trim();
  if (/^[A-Za-z]+-/.test(po)) {
    const c = String(customer || '').toUpperCase();
    if (c === 'OTB' || c === 'OTTO') {
      const m = po.match(/^[A-Za-z]+-(.+)$/i);
      return m ? `OTTO-${m[1].replace(/^OTTO-/i, '')}` : po;
    }
    return po;
  }
  return `${getCustomerPoPrefix(customer || '')}${po}`;
}

/** MRP: number only. OTB: OTTO-###. Others: full prefixed PO. */
export function formatCustomerPoForDisplay(customer, poNumber) {
  if (poNumber === null || poNumber === undefined || poNumber === '') {
    return 'N/A';
  }
  const c = String(customer || '').toUpperCase();
  if (c === 'MRP') {
    return formatCustomerPoNumberOnly(poNumber);
  }
  if (c === 'OTB' || c === 'OTTO') {
    return formatCustomerPoDisplay('OTB', poNumber);
  }
  return formatCustomerPoDisplay(customer, poNumber);
}

export function formatCustomerPoNumberOnly(poNumber) {
  if (poNumber === null || poNumber === undefined || poNumber === '') {
    return 'N/A';
  }

  const po = String(poNumber).trim();
  const match = po.match(/^[A-Za-z]+-(.+)$/);
  return match ? match[1] : po;
}

/** PO number in lists/reports — respects customer (OTB → OTTO-, MRP → FTM-). */
export function formatInternalPoDisplay(customer, internalPoNumber) {
  if (internalPoNumber === null || internalPoNumber === undefined || internalPoNumber === '') {
    return 'N/A';
  }
  const c = String(customer || '').toUpperCase();
  const po = String(internalPoNumber).trim();
  const digits = po.replace(/^[A-Za-z]+-/i, '');
  if (c === 'OTB' || c === 'OTTO') {
    return `OTTO-${digits.replace(/^OTTO-/i, '')}`;
  }
  if (c === 'MRP') {
    return formatFtmInternalPo(po);
  }
  if (c === 'OBSW' || c === 'OTHER') {
    const prefix = c === 'OTHER' ? 'FTM' : c;
    return `${prefix}-${digits}`;
  }
  const prefix = getInternalPoPrefix(customer).replace(/-$/, '');
  return `${prefix}-${digits}`;
}

export function isOtbCustomer(customer) {
  const c = String(customer || '').toUpperCase();
  return c === 'OTB' || c === 'OTTO';
}

/** FTM PO = internal_po_number, always shown as FTM-##### */
/** Format datetime for carton entry/exit display */
export function formatCartonDateTime(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export function getCartonEntryTime(carton) {
  if (!carton) return null;
  return carton.entry_timestamp
    || ((carton.status === 'entered' || carton.status === 'exited') ? carton.scan_timestamp : null);
}

export function getCartonExitTime(carton) {
  if (!carton) return null;
  return carton.exit_timestamp || (carton.status === 'exited' ? carton.scan_timestamp : null);
}

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
