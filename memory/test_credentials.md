"# Test Credentials for BlinkAware

## Admin Account
- Email: admin@blinkaware.com
- Password: SecureAdmin123!
- Role: admin

## Test User Account
- Email: user@blinkaware.com
- Password: TestUser123!
- Role: user

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## Session Endpoints
- POST /api/session/start
- POST /api/session/stop
- GET /api/session/current
- GET /api/analytics/sessions
- GET /api/analytics/daily
- GET /api/analytics/weekly

## Settings Endpoints
- GET /api/settings
- PUT /api/settings

## WebSocket
- Connect to: ws://{backend_url}/socket.io/
- Events: blink_detected, status_update, session_update
"