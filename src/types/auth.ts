import { User } from "./domain";

export type AuthUser = User & {
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};
