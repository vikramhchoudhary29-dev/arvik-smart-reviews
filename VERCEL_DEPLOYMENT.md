# Vercel deployment

- Source: https://github.com/vikramhchoudhary29-dev/arvik-smart-reviews
- Project: arvik-smart-reviews
- Team: vikramhchoudhary29-3054s-projects
- Public origin: https://arvik-smart-reviews.vercel.app
- Runtime: Node.js 24.x, Next.js App Router
- Install: npm ci --include=dev (Prisma CLI and TypeScript are required at build time)
- Build: npm run build (explicit Prisma Client generation runs first)

Production configuration is stored in Vercel environment variables. Real .env files, private keys, .vercel links, generated builds and verification artifacts are excluded from Git. The existing local configured database and Firebase project are used; no migrations or seed scripts are run by installation/build/deployment.

NEXT_PUBLIC_APP_URL is set to the public HTTPS origin for production. Client Firebase variables are build-time public identifiers; database URL, Firebase Admin key and administrator allowlist remain server-side settings. Local environment files are preserved. Preview credentials are not automatically shared with production resources.

Production releases should be staged, smoke-tested and promoted. Existing tests can run against isolated fixtures via npm test and npm run test:e2e. Do not use fake Google review submissions for deployment testing. A real verified allowlisted administrator should check sign-in after launch; Firebase authorized domains and API key restrictions must permit the deployed origin when applicable.
