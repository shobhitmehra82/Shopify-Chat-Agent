/**
 * UCP money is always an integer in the currency's ISO 4217 minor units, paired
 * with a currency code: { amount: 15260, currency: "USD" } is $152.60.
 *
 * Zero-decimal currencies (JPY, KRW, ...) are already whole units, so the
 * exponent must come from the currency, never from a hardcoded /100.
 *
 * This module is the ONLY place that converts. Everything upstream stays in
 * minor units.
 */

const exponentCache = new Map()

/** Number of decimal places for a currency, e.g. USD -> 2, JPY -> 0. */
export function minorUnitExponent(currency = 'USD') {
  const code = currency.toUpperCase()
  if (exponentCache.has(code)) return exponentCache.get(code)

  let digits = 2
  try {
    digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
    }).resolvedOptions().maximumFractionDigits
  } catch {
    // Unknown currency code — fall back to 2.
  }
  exponentCache.set(code, digits)
  return digits
}

/** 15260 USD -> 152.6 */
export function minorToMajor(amount, currency = 'USD') {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null
  return amount / 10 ** minorUnitExponent(currency)
}

/** 152.6 USD -> 15260. Used to turn a buyer's "$100" into a UCP price filter. */
export function majorToMinor(amount, currency = 'USD') {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null
  return Math.round(amount * 10 ** minorUnitExponent(currency))
}

/** { amount: 15260, currency: "USD" } -> "$152.60" */
export function formatMoney(money, locale = 'en-US') {
  if (!money || typeof money.amount !== 'number') return null
  const currency = money.currency || 'USD'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      minorToMajor(money.amount, currency),
    )
  } catch {
    return `${minorToMajor(money.amount, currency)} ${currency}`
  }
}

/** Adds a human-readable `formatted` alongside the raw minor-unit amount. */
export function withFormatted(money, locale = 'en-US') {
  if (!money || typeof money.amount !== 'number') return null
  return {
    amount: money.amount,
    currency: money.currency || 'USD',
    formatted: formatMoney(money, locale),
  }
}
