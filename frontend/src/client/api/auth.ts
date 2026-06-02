import type { User } from "@/client/app/App";
import { apiRequest } from "@/client/api/client";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  const res = await apiRequest<{ user: User }>("/auth/register", {
    method: "POST",
    body: payload,
  });
  return res.user;
}

export async function loginUser(payload: LoginPayload): Promise<User> {
  const res = await apiRequest<{ user: User }>("/auth/login", {
    method: "POST",
    body: payload,
  });
  return res.user;
}

export async function updateUserProfile(currentEmail: string, user: User): Promise<User> {
  const res = await apiRequest<{ user: User }>(`/users/${encodeURIComponent(currentEmail)}`, {
    method: "PATCH",
    body: user,
  });
  return res.user;
}
