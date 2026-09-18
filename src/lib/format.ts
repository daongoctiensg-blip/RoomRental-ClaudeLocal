export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export function zaloHref(phone: string): string {
  return `https://zalo.me/${phone.replace(/\D/g, "")}`;
}
