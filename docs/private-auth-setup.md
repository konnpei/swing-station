# KabuBocchi private email authentication

The existing public home page remains unchanged. Private dashboard is at /private and is server-rendered with no-store. The private API is not available until all required secrets are configured.

## Required Vercel environment variables (Production and Preview)
- PRIVATE_OWNER_EMAIL: only permitted owner email
- PRIVATE_SESSION_SECRET: randomly generated secret, 32+ characters
- UPSTASH_REDIS_REST_URL: Upstash Redis REST endpoint
- UPSTASH_REDIS_REST_TOKEN: Upstash Redis REST token
- RESEND_API_KEY: Resend mail API key
- PRIVATE_SITE_ORIGIN: fixed HTTPS origin, e.g. https://swing-station-app.vercel.app\n- PRIVATE_EMAIL_FROM: verified sending address, e.g. KabuBocchi <login@yourdomain.example>

Configure these directly in Vercel settings. Never commit credentials. Verify the Resend sending domain first. The login link expires after 10 minutes and can be redeemed only once (Redis GETDEL). Sessions expire after 12 hours and use HttpOnly Secure SameSite=Lax cookies. Requests are rate limited to once per IP per 60 seconds. Consider stronger per-account and abuse protection before broad public launch.

## Security notes
- Keep personal portfolio data in a separate protected database; do not commit it to GitHub or store it under /public.
- Each private API endpoint must call validSession(req.cookies?.[sessionCookie]) before querying or returning personal records. Client-only route guards are insufficient.
- This scaffold does not import private portfolio data or connect a brokerage account.
- Public routes are unchanged. Test unauthenticated access, expired links, replayed links, logout and caching before merging.
- Login email links use the fixed PRIVATE_SITE_ORIGIN rather than untrusted request host headers.
