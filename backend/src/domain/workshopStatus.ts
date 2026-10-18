import { BadRequestError } from '../utils/errors.js';

export const JobType = {
  REPAIR: 'REPAIR',
  MANUFACTURING: 'MANUFACTURING',
  POLISHING: 'POLISHING',
  SETTING: 'SETTING',
  ALTERATION: 'ALTERATION',
  OTHER: 'OTHER',
} as const;

export type JobTypeEnum = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  DRAFT: 'DRAFT',
  READY_TO_ISSUE: 'READY_TO_ISSUE',
  ISSUED: 'ISSUED',
  IN_PROGRESS: 'IN_PROGRESS',
  RETURNED: 'RETURNED',
  QUALITY_CHECK: 'QUALITY_CHECK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type JobStatusEnum = (typeof JobStatus)[keyof typeof JobStatus];

export const JobPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type JobPriorityEnum = (typeof JobPriority)[keyof typeof JobPriority];

export const RepairStatus = {
  RECEIVED: 'RECEIVED',
  ASSIGNED: 'ASSIGNED',
  IN_REPAIR: 'IN_REPAIR',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type RepairStatusEnum = (typeof RepairStatus)[keyof typeof RepairStatus];

export const RepairOwnership = {
  CUSTOMER_OWNED: 'CUSTOMER_OWNED',
  SHOP_OWNED: 'SHOP_OWNED',
} as const;

export type RepairOwnershipEnum = (typeof RepairOwnership)[keyof typeof RepairOwnership];

/**
 * Valid status transitions for a Karigar Job
 */
export const ALLOWED_JOB_TRANSITIONS: Record<JobStatusEnum, readonly JobStatusEnum[]> = {
  [JobStatus.DRAFT]: [JobStatus.READY_TO_ISSUE, JobStatus.ISSUED, JobStatus.CANCELLED],
  [JobStatus.READY_TO_ISSUE]: [JobStatus.ISSUED, JobStatus.DRAFT, JobStatus.CANCELLED],
  [JobStatus.ISSUED]: [JobStatus.IN_PROGRESS, JobStatus.RETURNED, JobStatus.QUALITY_CHECK, JobStatus.COMPLETED],
  [JobStatus.IN_PROGRESS]: [JobStatus.RETURNED, JobStatus.QUALITY_CHECK, JobStatus.COMPLETED],
  [JobStatus.RETURNED]: [JobStatus.QUALITY_CHECK, JobStatus.COMPLETED],
  [JobStatus.QUALITY_CHECK]: [JobStatus.COMPLETED, JobStatus.IN_PROGRESS],
  [JobStatus.COMPLETED]: [],
  [JobStatus.CANCELLED]: [],
};

export function assertValidJobTransition(fromStatus: JobStatusEnum, toStatus: JobStatusEnum): void {
  if (fromStatus === toStatus) return;
  const allowed = ALLOWED_JOB_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new BadRequestError(
      `Invalid workshop job status transition from '${fromStatus}' to '${toStatus}'.`
    );
  }
}

/**
 * Valid status transitions for a Repair order
 */
export const ALLOWED_REPAIR_TRANSITIONS: Record<RepairStatusEnum, readonly RepairStatusEnum[]> = {
  [RepairStatus.RECEIVED]: [RepairStatus.ASSIGNED, RepairStatus.IN_REPAIR, RepairStatus.CANCELLED],
  [RepairStatus.ASSIGNED]: [RepairStatus.IN_REPAIR, RepairStatus.READY, RepairStatus.CANCELLED],
  [RepairStatus.IN_REPAIR]: [RepairStatus.READY, RepairStatus.ASSIGNED, RepairStatus.CANCELLED],
  [RepairStatus.READY]: [RepairStatus.DELIVERED, RepairStatus.IN_REPAIR],
  [RepairStatus.DELIVERED]: [],
  [RepairStatus.CANCELLED]: [],
};

export function assertValidRepairTransition(fromStatus: RepairStatusEnum, toStatus: RepairStatusEnum): void {
  if (fromStatus === toStatus) return;
  const allowed = ALLOWED_REPAIR_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new BadRequestError(
      `Invalid repair status transition from '${fromStatus}' to '${toStatus}'.`
    );
  }
}
