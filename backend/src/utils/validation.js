/**
 * Asserts that a value is present (not null, undefined, or empty string).
 *
 * @template T
 * @param {T} value
 * @param {string} label
 * @param {new (msg: string) => Error} [ErrorClass=Error]
 * @returns {NonNullable<T>}
 */
export function requireValue(value, label, ErrorClass = Error) {
  if (value === null || value === undefined || value === '') {
    throw new ErrorClass(`Missing required value: ${label}`);
  }
  return value;
}

/**
 * Standardizes Zod validation error handling across Express controllers.
 * Sets statusCode to 400 and formats the error message.
 *
 * @param {Error & { statusCode?: number }} error
 * @param {string} [customMessage]
 * @returns {Error}
 */
export function handleValidationError(error, customMessage) {
  if (error.name === 'ZodError') {
    error.statusCode = 400;
    if (customMessage) {
      error.message = customMessage;
    }
  }
  return error;
}
