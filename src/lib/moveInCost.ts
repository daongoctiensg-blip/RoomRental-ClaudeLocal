import type { DepositPolicy } from "@/types";

/**
 * "Chi phí nhận phòng dự kiến" — round 12, the rental-site stand-in for
 * trip.com's price-breakdown step. Built only from the property's deposit
 * policy + the room's monthly rent, following the 3-step flow:
 *   1. hold the room: holdAmount (for holdDays),
 *   2. sign the contract: top up the deposit to the full security deposit
 *      (securityDepositMonths × rent),
 *   3. prepay rent: prepaidRentMonths × rent.
 *
 * Business rule confirmed by the owner (round 12c): the hold amount is NOT
 * an extra cost — it BECOMES part of the security deposit ("cọc giữ chỗ
 * biến thành cọc nhà"). At signing the customer only pays the difference.
 * So the total money in is always securityDeposit + prepaidRent, whether or
 * not they held the room first.
 */
export interface MoveInCost {
  holdAmount: number;
  holdDays: number;
  securityDepositMonths: number;
  /** Full security deposit (cọc nhà) = securityDepositMonths × rent. */
  securityDeposit: number;
  /** Paid at signing on top of the hold: securityDeposit − holdAmount,
   * never below 0 (a hold larger than the deposit is not refunded here —
   * that's a landlord conversation, not something to invent in the UI). */
  depositTopUp: number;
  prepaidRentMonths: number;
  prepaidRent: number;
  /** What the customer hands over at the signing appointment itself. */
  payAtSigning: number;
  /** Everything the customer pays to move in, hold included:
   * securityDeposit + prepaidRent (or hold + prepaid if the hold is larger
   * than the deposit). */
  totalMoveIn: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export function calculateMoveInCost(priceMonthly: number, policy: DepositPolicy): MoveInCost {
  const rent = num(priceMonthly);
  const holdAmount = num(policy.holdAmount);
  const securityDepositMonths = num(policy.securityDepositMonths);
  const prepaidRentMonths = num(policy.prepaidRentMonths);
  const securityDeposit = Math.round(rent * securityDepositMonths);
  const prepaidRent = Math.round(rent * prepaidRentMonths);
  const depositTopUp = Math.max(0, securityDeposit - holdAmount);
  const payAtSigning = depositTopUp + prepaidRent;
  return {
    holdAmount,
    holdDays: num(policy.holdDays),
    securityDepositMonths,
    securityDeposit,
    depositTopUp,
    prepaidRentMonths,
    prepaidRent,
    payAtSigning,
    totalMoveIn: holdAmount + payAtSigning,
  };
}
