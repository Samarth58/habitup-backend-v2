# HabitUp Backend

## Testing

Run the normal suite with:

npm test

The main test suite requires an elevated `AUTH_RATE_LIMIT_MAX` for the test run so the combined auth calls across all files do not hit the production 10/15min limit during CI or local runs. The script in package.json sets this for the test run automatically.

Run the rate-limit test separately with a fresh server restart:

npm run test:rate-limit

The auth rate-limit test is intentionally isolated because it exercises the IP-based login/register limiter and consumes its 10-request window. It must run on a fresh server instance to avoid cross-test contamination and false failures in the main suite.
