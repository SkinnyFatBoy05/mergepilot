export interface Delivery { id: string; attempt: number; nextAt: number }
export const nextDelivery = (delivery: Delivery, retryAfterSeconds?: number): Delivery => ({ ...delivery, attempt: delivery.attempt + 1, nextAt: Date.now() + (retryAfterSeconds ?? 2 ** delivery.attempt) * 1_000 });
export const exhausted = (delivery: Delivery): boolean => delivery.attempt >= 5;
