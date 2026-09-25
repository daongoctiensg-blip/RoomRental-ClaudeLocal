import type { DepositPolicy } from "@/types";

/**
 * "Chi phí nhận phòng dự kiến" — round 12, the rental-site stand-in for
 * trip.com's price-breakdown step. Built only from data the property
 * already has (its deposit policy) + the room's monthly rent, following the
 * 3-step flow in the business requirements:
 *   1. hold the room (holdAmount, for holdDays) once the customer decides,
 *   2. sign the contract: security deposit = securityDepositMonths × rent,
 *   3. prepay rent: prepaidRentMonths × rent.
 * `totalAtSigning` deliberately covers steps 2+3 only and is labeled as
 * such on the page — whether the step-1 hold amount is credited against it
 * is NOT encoded anywhere in the data, so it is not assumed either way
 * (flagged to the owner to confirm).
 */
export interface MoveInCost {
  holdAmount: number;
  holdDays: number;
  securityDepositMonths: number;
  securityDeposit: number;
  prepaidRentMonths: number;
  prepaidRent: number;
  totalAtSigning: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export function calculateMoveInCost(priceMonthly: number, policy: DepositPolicy): MoveInCost {
  const rent = num(priceMonthly);
  const securityDepositMonths = num(policy.securityDepositMonths);
  const prepaidRentMonths = num(policy.prepaidRentMonths);
  const securityDeposit = Math.round(rent * securityDepositMonths);
  const prepaidRent = Math.round(rent * prepaidRentMonths);
  return {
    holdAmount: num(policy.holdAmount),
    holdDays: num(policy.holdDays),
    securityDepositMonths,
    securityDeposit,
    prepaidRentMonths,
    prepaidRent,
    totalAtSigning: securityDeposit + prepaidRent,
  };
}
