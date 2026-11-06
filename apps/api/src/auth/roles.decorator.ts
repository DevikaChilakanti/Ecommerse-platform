import { SetMetadata } from "@nestjs/common";
import { RoleCode } from "./auth.types";

export const ROLES_KEY = "required_roles";
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
