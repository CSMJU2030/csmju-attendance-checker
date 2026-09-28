/** Subsystem-local roles. Deliberately NOT identical to Core Hub role names. */
export enum SubsystemRole {
  STUDENT = 'STUDENT',
  ALUMNI = 'ALUMNI',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

/**
 * Identity attached to a request. Every field originates from a
 * cryptographically verified Core Hub JWT claim - never from a header or body.
 */
export interface CoreHubIdentity {
  /** Core Hub user id (`sub`). */
  id: string;
  /** Core Hub email (`email`). */
  email: string;
  /** Core Hub central role (`role`). */
  coreRole: string;
  /** Core Hub session id (`sid`). */
  sessionId?: string;
  /** Result of the subsystem's own role mapping. */
  subsystemRole: SubsystemRole;
}

export interface CoreHubTokenPayload {
  sub: string;
  email?: string;
  role?: string;
  sid?: string;
  iss: string;
  aud: string | string[];
  iat?: number;
  exp?: number;
}
