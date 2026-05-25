/** Spec 1.5 — warehouse order status (POs + legacy stock) */
export const WAREHOUSE_ORDER_STATUS_OPTIONS = {
  active: 'Active',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
  not_audited: 'Not audited',
  failed_audit: 'Failed audit',
  waiting_for_booking: 'Waiting for booking'
};

export const WAREHOUSE_ORDER_STATUS_BADGE = {
  active: 'primary',
  shipped: 'success',
  cancelled: 'danger',
  not_audited: 'secondary',
  failed_audit: 'warning',
  waiting_for_booking: 'info'
};

export const getWarehouseOrderStatusLabel = (key) =>
  WAREHOUSE_ORDER_STATUS_OPTIONS[key] || key;

export const getWarehouseOrderStatusBadge = (key) =>
  WAREHOUSE_ORDER_STATUS_BADGE[key] || 'secondary';
