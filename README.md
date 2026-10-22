# CarePulse Backend

Express + TypeScript + Prisma + PostgreSQL API for emergency health records.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill values
3. `npx prisma migrate dev`
4. `npx prisma db seed`
5. `npm run dev`

Seed users (password `Password@123`): admin@, doctor@, responder@carepulse.test