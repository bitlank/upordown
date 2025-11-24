import type { ApiUser } from "../../../backend/src/shared/api-interfaces";
import { fetchEmpty, fetchJson } from "./fetch";

export async function getUser(): Promise<ApiUser> {
  return await fetchJson("/user");
}

export async function login(): Promise<void> {
  await fetchEmpty("/auth", "POST");
}
