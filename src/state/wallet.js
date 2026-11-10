/**
 * The only low-level balance and token mutation layer.
 * UI, games and shop code request operations through the wallet context;
 * this module can later be replaced with an API-backed implementation.
 */
export function debit(balance, amount) {
  if (!Number.isFinite(amount) || amount <= 0 || balance < amount) return null
  return balance - amount
}
export function credit(balance, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return balance
  return balance + amount
}
export function refund(balance, amount) {
  return credit(balance, amount)
}
export function setBalance(_balance, nextBalance) {
  return Number.isFinite(nextBalance) ? Math.max(0, Math.floor(nextBalance)) : _balance
}
export function tokenAdd(inventory, token, count = 1, cap = 5) {
  const next = { ...inventory }
  const current = Number(next[token] ?? 0)
  const added = Math.max(0, Math.min(cap - current, Math.floor(count)))
  if (added > 0) next[token] = current + added
  return { inventory: next, added }
}
export function tokenRemove(inventory, token, count = 1) {
  const next = { ...inventory }
  const current = Number(next[token] ?? 0)
  if (!Number.isInteger(count) || count <= 0 || current < count) return null
  next[token] = current - count
  return next
}
