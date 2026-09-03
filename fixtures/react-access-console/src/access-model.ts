export interface AccessRequest { id: number; subject: string; enabled: boolean }
export const acceptResponse = (latestRequestId: number, response: AccessRequest): AccessRequest | undefined => response.id === latestRequestId ? response : undefined;
export const rollback = (previous: AccessRequest): AccessRequest => ({ ...previous });
