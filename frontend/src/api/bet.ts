import type {
  ApiBet,
  ApiBetInfo,
  BetDirection,
} from "../../../backend/src/shared/api-interfaces";
import { fetchJson } from "./fetch";

export async function getBetInfo(): Promise<ApiBetInfo> {
  return await fetchJson("/bet/info");
}

export async function getOpenBets(): Promise<ApiBet[]> {
  return await fetchJson("/bet/open");
}

export async function placeBet(
  ticker: string,
  direction: BetDirection,
): Promise<ApiBet> {
  return await fetchJson(`/bet/${ticker}/${direction}`, "POST");
}
