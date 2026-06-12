/**
 * Display helpers for customer vs internal PO numbers.
 */

export function getCustomerPoPrefix(customer) {
  if (customer === 'MRP') return '';
  if (customer === 'OTB') return 'OTTO-';
  return `${customer}-`;
}

/** Internal PO prefix is always FTM-. */
export function getInternalPoPrefix() {
  return 'FTM-';
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

/** PO number in lists/reports — internal PO always normalizes to FTM-. */
export function formatInternalPoDisplay(customer, internalPoNumber) {
  if (internalPoNumber === null || internalPoNumber === undefined || internalPoNumber === '') {
    return 'N/A';
  }
  const po = String(internalPoNumber).trim();
  return formatFtmInternalPo(po);
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

/** Direct "mark as shipped" — manual OTB/OBSW/etc. only; Mr Price must use exit scanner. */
export function canDirectShipOrder(shipment) {
  if (!shipment || shipment.entry_type !== 'manual') {
    return false;
  }
  return String(shipment.customer || 'MRP').toUpperCase() !== 'MRP';
}
