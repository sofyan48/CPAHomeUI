export type DateInputType = 'date' | 'datetime-local'

export const minimumDate = '0001-01-01'
export const maximumDate = '9999-12-31'

// Validate calendar parts directly: Date parsing can silently roll February 30 into March.
export function isDateInputValid(value: string, type: DateInputType = 'date'): boolean {
  if (!value) return true
  const pattern = type === 'date' ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/
  const match = value.match(pattern)
  if (!match) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!
}

export function dateRangeError(from = '', to = '', type: DateInputType = 'date'): string {
  if (!isDateInputValid(from, type) || !isDateInputValid(to, type)) {
    return type === 'date' ? 'Enter a valid date in YYYY-MM-DD format (year 0001–9999).' : 'Enter a valid date and time in YYYY-MM-DDTHH:mm format (year 0001–9999).'
  }
  return from && to && from > to ? 'Start must be on or before end.' : ''
}

export function dateInputBounds(type: DateInputType, min = '', max = '') {
  return {
    min: min && isDateInputValid(min, type) ? min : `${minimumDate}${type === 'date' ? '' : 'T00:00'}`,
    max: max && isDateInputValid(max, type) ? max : `${maximumDate}${type === 'date' ? '' : 'T23:59'}`
  }
}

export function sanitizeDateInput(value: string) {
  // Limit only the year; leave other incomplete/invalid parts editable for correction.
  return value.replace(/^(\d{4})\d+/, '$1')
}
