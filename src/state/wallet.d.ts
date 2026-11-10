export function debit(balance: number, amount: number): number | null
export function credit(balance: number, amount: number): number
export function refund(balance: number, amount: number): number
export function tokenAdd(inventory: Record<string, number>, token: string, count?: number, cap?: number): { inventory: Record<string, number>; added: number }
export function tokenRemove(inventory: Record<string, number>, token: string, count?: number): Record<string, number> | null
export function setBalance(balance: number, nextBalance: number): number
