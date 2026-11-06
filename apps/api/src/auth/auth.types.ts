import { Request } from "express";

export type RoleCode = "CUSTOMER" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleCode[];
  createdAt: Date;
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    user: UserProfile;
    sessionId: string;
  };
}
