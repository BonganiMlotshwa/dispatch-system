import {
  WAREHOUSE_ORDER_STATUS_OPTIONS,
  WAREHOUSE_ORDER_STATUS_BADGE
} from './warehouseOrderStatuses';

export const LEGACY_STATUS_OPTIONS = WAREHOUSE_ORDER_STATUS_OPTIONS;
export const LEGACY_STATUS_BADGE = WAREHOUSE_ORDER_STATUS_BADGE;

export const emptyLegacyForm = () => ({
  internal_po: '',
  customer_order_number: '',
  customer: 'MRP',
  customer_other: '',
  style: '',
  color: '',
  order_qty: '',
  quantity_inside: '',
  cartons_label: '',
  cartons_count: '',
  status: 'active',
  remarks: '',
  new_developments: '',
  shipped_qty: '0',
  source_year: '2025'
});
