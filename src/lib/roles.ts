export const USER_ROLES = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_STATUSES = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];
