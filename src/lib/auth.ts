import { USER_ROLES, type UserRole } from "./roles";

export type AuthSession = {
  userId: string;
  role: UserRole;
} | null;

export async function getCurrentSession(): Promise<AuthSession> {
  return null;
}

export function canAccessRole(session: AuthSession, role: UserRole) {
  return session?.role === role;
}

export function isAdmin(session: AuthSession) {
  return canAccessRole(session, USER_ROLES.ADMIN);
}

export function isTeacher(session: AuthSession) {
  return canAccessRole(session, USER_ROLES.TEACHER);
}
