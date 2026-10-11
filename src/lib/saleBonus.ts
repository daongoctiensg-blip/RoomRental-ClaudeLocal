/** Is today (UTC date, same rule as signContract's isWithin) inside the
 * bonus window? Kept in one place for the internal export; the room detail
 * page and RoomCard still carry their own older copies. */
export function isBonusActiveToday(validFrom: string, validTo: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return today >= validFrom && today <= validTo;
}
