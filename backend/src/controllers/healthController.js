/**
 * Controller for health check endpoints.
 */
export function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'live-cricket-copilot-api',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
}

