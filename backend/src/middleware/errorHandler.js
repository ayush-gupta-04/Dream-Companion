/**
 * Global error handling middleware.
 */
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[Request] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(status).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}
