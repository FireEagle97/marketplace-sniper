export const FREE_ALERT_LIMIT = 3;

export function canCreateAlert({
  plan,
  alertCount,
}: {
  plan: string;
  alertCount: number;
}): boolean {
  if (plan === "paid") return true;
  return alertCount < FREE_ALERT_LIMIT;
}
