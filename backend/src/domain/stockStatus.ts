import { BadRequestError } from '../utils/errors.js';

export const StockStatus = {
  IN_STOCK: 'IN_STOCK',
  SOLD: 'SOLD',
  EXCHANGED: 'EXCHANGED',
  REPAIR: 'REPAIR',
  WITH_KARIGAR: 'WITH_KARIGAR',
  RESERVED: 'RESERVED',
  RETURNED: 'RETURNED',
  ADJUSTED: 'ADJUSTED',
  DAMAGED: 'DAMAGED',
} as const;

export type StockStatusType = (typeof StockStatus)[keyof typeof StockStatus];

export const MovementType = {
  OPENING_STOCK: 'OPENING_STOCK',
  PURCHASE_IN: 'PURCHASE_IN',
  SALE_OUT: 'SALE_OUT',
  EXCHANGE_IN: 'EXCHANGE_IN',
  EXCHANGE_OUT: 'EXCHANGE_OUT',
  REPAIR_OUT: 'REPAIR_OUT',
  REPAIR_IN: 'REPAIR_IN',
  KARIGAR_ISSUE: 'KARIGAR_ISSUE',
  KARIGAR_RETURN: 'KARIGAR_RETURN',
  RETURN_IN: 'RETURN_IN',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
} as const;

export type MovementTypeEnum = (typeof MovementType)[keyof typeof MovementType];

/**
 * Controlled Stock Status Transition Map:
 * Defines permissible next statuses from each current status.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<StockStatusType, readonly StockStatusType[]> = {
  [StockStatus.IN_STOCK]: [
    StockStatus.SOLD,
    StockStatus.EXCHANGED,
    StockStatus.REPAIR,
    StockStatus.WITH_KARIGAR,
    StockStatus.RESERVED,
    StockStatus.ADJUSTED,
    StockStatus.DAMAGED,
  ],
  [StockStatus.REPAIR]: [
    StockStatus.IN_STOCK,
    StockStatus.DAMAGED,
    StockStatus.ADJUSTED,
  ],
  [StockStatus.WITH_KARIGAR]: [
    StockStatus.IN_STOCK,
    StockStatus.REPAIR,
    StockStatus.ADJUSTED,
  ],
  [StockStatus.RESERVED]: [
    StockStatus.IN_STOCK,
    StockStatus.SOLD,
  ],
  [StockStatus.RETURNED]: [
    StockStatus.IN_STOCK,
    StockStatus.REPAIR,
    StockStatus.ADJUSTED,
  ],
  [StockStatus.ADJUSTED]: [
    StockStatus.IN_STOCK,
  ],
  [StockStatus.DAMAGED]: [
    StockStatus.REPAIR,
    StockStatus.ADJUSTED,
  ],
  // Terminal/Controlled states: once sold or exchanged, direct status manipulation is prohibited.
  [StockStatus.SOLD]: [],
  [StockStatus.EXCHANGED]: [],
};

/**
 * Validates whether transitioning from current status to target status is permitted.
 */
export function isValidStatusTransition(
  fromStatus: StockStatusType,
  toStatus: StockStatusType
): boolean {
  if (fromStatus === toStatus) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Asserts valid status transition or throws BadRequestError.
 */
export function assertValidStatusTransition(
  fromStatus: StockStatusType,
  toStatus: StockStatusType
): void {
  if (!isValidStatusTransition(fromStatus, toStatus)) {
    throw new BadRequestError(
      `Invalid stock status transition from '${fromStatus}' to '${toStatus}'. Direct transition not allowed.`
    );
  }
}
