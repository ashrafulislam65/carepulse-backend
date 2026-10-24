<div align="center">

# 🫀 CarePulse / MedVault — Backend API

**Unified Emergency Health Records & Smart Service Network**

REST API and realtime server for emergency QR profiles, SOS dispatch, records, appointments and payments

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socketdotio&logoColor=white)

</div>

---

## 📖 Overview

This is the **backend** of CarePulse / MedVault. It provides authentication, role based access control, the two-layer emergency QR system, SOS dispatch with realtime location, S3 backed medical records, a symptom triage engine, concurrency-safe appointment booking, Stripe payments and PDF invoices.

Web client: [carepulse-frontend](https://github.com/ashrafulislam65/carepulse-frontend)

## ✨ Features

- 🔐 **JWT authentication** with bcrypt hashed passwords and four roles: `PATIENT`, `DOCTOR`, `RESPONDER`, `ADMIN`
- 🔲 **Dual-layer Emergency QR**
  - Public layer: blood group, allergies, conditions, emergency contacts
  - Protected layer: full history for staff login or patient PIN (15 minute unlock token)
  - Signed, expiring QR tokens with **instant revocation** (token version)
- 🚨 **SOS dispatch**: alert creation, nearest hospital search (Haversine), SMS notification stub, accept / resolve / cancel, race-safe accept
- 📡 **Socket.io**: authenticated realtime alerts and live GPS between patient and responder
- 📁 **Records vault**: AWS S3 presigned upload and download URLs, per-patient access checks
- 🩺 **Triage engine**: rule-based urgency scoring (Emergency / Urgent / Non-urgent), replaceable with an ML or LLM model
- 📅 **Appointments**: slot generation, **Serializable transactions** to prevent double booking, queue position and wait estimate
- 💳 **Payments**: Stripe Checkout, signature-verified idempotent webhook, PDF invoices (PDFKit)
- 🛡️ **Hardening**: Helmet, CORS allow-list, Zod validation, rate limiting on login, PIN and triage

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Language | TypeScript (`tsx` for dev) |
| ORM | Prisma 6 |
| Database | PostgreSQL (Neon) |
| Realtime | Socket.io |
| Validation | Zod |
| Auth | JSON Web Tokens, bcryptjs |
| Storage | AWS S3 (`@aws-sdk/client-s3`, presigned URLs) |
| Payments | Stripe |
| Documents / QR | PDFKit, qrcode |
| Security | Helmet, CORS, express-rate-limit |

## 🏗️ Architecture

```
          ┌──────────────────────────────┐
          │   Next.js client (Vercel)    │
          └──────────────┬───────────────┘
                         │ HTTPS / WSS
          ┌──────────────▼───────────────┐
          │  Express API  +  Socket.io   │
          │  Auth · RBAC · Validation    │
          └───┬──────────┬───────────┬───┘
              │          │           │
     ┌────────▼───┐ ┌────▼─────┐ ┌───▼────────┐
     │ PostgreSQL │ │  Stripe  │ │   AWS S3   │
     │ via Prisma │ │ payments │ │ encrypted  │
     │   (Neon)   │ │ webhooks │ │ documents  │
     └────────────┘ └──────────┘ └────────────┘
```

## 🗂️ Folder Structure

```
carepulse-backend/
├── api/
│   └── index.ts                # Vercel serverless entry
├── prisma/
│   ├── schema.prisma           # Data models
│   ├── migrations/
│   └── seed.ts                 # Admin, doctor, responder, hospitals
├── src/
│   ├── config/
│   │   └── env.ts              # Zod validated environment
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client
│   │   ├── qr.ts               # Signed QR tokens and revocation
│   │   ├── s3.ts               # Presigned upload / download
│   │   ├── stripe.ts
│   │   ├── notify.ts           # SMS stub (replace with Twilio etc.)
│   │   ├── socket.ts           # Socket.io server
│   │   ├── slots.ts            # Appointment slot helpers
│   │   ├── geo.ts              # Haversine distance
│   │   ├── hospitals.ts        # Nearest hospitals
│   │   ├── access.ts           # Who can access which patient
│   │   └── patient.ts
│   ├── middlewares/
│   │   ├── auth.ts             # authenticate, authorize(roles)
│   │   ├── error.ts
│   │   └── rateLimit.ts
│   ├── modules/
│   │   ├── auth/               # register, login, me
│   │   ├── patients/           # profile, contacts, PIN, QR
│   │   ├── emergency/          # public + protected emergency profile
│   │   ├── records/            # S3 medical records
│   │   ├── alerts/             # SOS dispatch
│   │   ├── triage/             # symptom engine
│   │   ├── appointments/       # booking and queue
│   │   ├── payments/           # Stripe + invoice PDF
│   │   ├── hospitals/
│   │   └── admin/
│   ├── types/express.d.ts
│   ├── utils/{errors,tokens}.ts
│   ├── app.ts                  # Express app and routes
│   └── server.ts               # HTTP server + Socket.io
├── vercel.json
├── tsconfig.json
└── .env.example
```

## 🗄️ Data Model

`User` → `PatientProfile` / `DoctorProfile` · `PatientProfile` → `EmergencyContact[]`, `MedicalRecord[]`, `Appointment[]`, `EmergencyAlert[]` · `Hospital` (standalone)

| Enum | Values |
|---|---|
| `Role` | PATIENT, DOCTOR, RESPONDER, ADMIN |
| `AlertStatus` | TRIGGERED, DISPATCHED, RESOLVED, CANCELLED |
| `AppointmentStatus` | SCHEDULED, COMPLETED, CANCELLED |
| `PaymentStatus` | PENDING, PAID, FAILED |

## 📡 API Reference

Base URL: `/api`. Protected routes need `Authorization: Bearer <token>`.

| Area | Endpoint | Access |
|---|---|---|
| Health | `GET /health` | Public |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` | Public / any user |
| Patient | `GET·PATCH /patients/me` · `PUT /patients/me/pin` | Patient |
| Contacts | `POST /patients/me/contacts` · `PATCH·DELETE /patients/me/contacts/:id` | Patient |
| QR | `GET /patients/me/qr` · `POST /patients/me/qr/revoke` | Patient |
| Emergency | `GET /emergency/:token` | Public |
| | `POST /emergency/:token/unlock` (PIN, rate limited) | Public |
| | `GET /emergency/:token/full` | Staff token or unlock token |
| Records | `POST /records/upload-url` · `POST /records` · `GET /records` | Patient / Doctor / Admin |
| | `GET /records/:id/download-url` · `DELETE /records/:id` | Owner / authorized |
| SOS | `POST /alerts` · `PATCH /alerts/:id/cancel` | Patient |
| | `GET /alerts/active` · `PATCH /alerts/:id/accept` | Responder / Admin |
| | `PATCH /alerts/:id/resolve` · `GET /alerts/:id` | Responder / Admin / owner |
| Triage | `POST /triage/check` | Public (rate limited) |
| Appointments | `GET /appointments/doctors` · `GET /appointments/doctors/:id/slots?date=` | Public |
| | `POST /appointments` | Patient |
| | `GET /appointments/mine` · `GET /appointments/:id/queue` | Patient / Doctor / Admin |
| | `PATCH /appointments/:id/cancel` · `PATCH /appointments/:id/complete` | Authorized / Doctor |
| Payments | `POST /payments/checkout/:appointmentId` | Patient |
| | `GET /payments/invoice/:appointmentId` | Patient / Doctor / Admin |
| | `POST /payments/webhook` | Stripe |
| Admin | `POST /admin/users` · `GET·POST /hospitals` | Admin |

### Socket.io events

Connect with `io(API_URL, { auth: { token } })`.

| Event | Direction | Purpose |
|---|---|---|
| `alert:new` | server → responders | New SOS created |
| `alert:updated` | server → room | Status or responder changed |
| `alert:join` | client → server | Join an alert room |
| `location:update` | client ↔ server | Live GPS (patient and assigned responder only) |

## 🔄 Complete Workflow

### Emergency QR

1. Patient fills profile, contacts and sets a PIN.
2. `GET /patients/me/qr` returns a **signed JWT link** and a QR image.
3. Anyone scanning calls `GET /emergency/:token`. The server verifies the signature, expiry and `qrTokenVersion`, then returns only the public layer.
4. Staff with a valid login, or anyone with the PIN (`POST /unlock` returns a 15 minute token), can call `GET /full`.
5. `POST /patients/me/qr/revoke` increments the version, so every old link is dead instantly.

### SOS

1. Patient sends GPS to `POST /alerts`. The server creates the alert, finds the 3 nearest hospitals, emits `alert:new` to responders and sends SMS to emergency contacts.
2. A responder calls `accept`. The update uses `updateMany` with `status = TRIGGERED`, so exactly one responder wins.
3. Patient and responder stream GPS over `location:update`.
4. Responder `resolve`, or patient `cancel`, closes the alert.

### Appointments and payments

1. Slots are generated from `SLOT_START_HOUR`, `SLOT_END_HOUR` and `SLOT_MINUTES` in the clinic time zone.
2. Booking runs in a **Serializable transaction**, so two patients cannot take the same slot.
3. Queue position = scheduled appointments of that doctor earlier the same day.
4. Checkout creates a Stripe session. The signed webhook marks the appointment `PAID` idempotently.
5. `GET /payments/invoice/:id` streams a PDF invoice.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local or [Neon](https://neon.tech))

### Installation

```bash
git clone https://github.com/ashrafulislam65/carepulse-backend.git
cd carepulse-backend
npm install
cp .env.example .env        # then fill the values
npx prisma migrate dev
npx prisma db seed
npm run dev
```

API runs on **http://localhost:5000**. Check `GET /api/health`.

### Environment variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default 5000) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random secret (16+ chars) |
| `JWT_EXPIRES_IN` | Access token lifetime, e.g. `1d` |
| `FRONTEND_URL` | Allowed CORS origin and QR link base, no trailing slash |
| `QR_TOKEN_EXPIRES_IN` | QR link lifetime, e.g. `365d` |
| `UNLOCK_TOKEN_EXPIRES_IN` | PIN unlock lifetime, e.g. `15m` |
| `TZ_OFFSET_MINUTES` | Clinic time zone offset (Bangladesh: `360`) |
| `SLOT_START_HOUR` / `SLOT_END_HOUR` / `SLOT_MINUTES` | Appointment slot window |
| `PAYMENT_CURRENCY` | e.g. `usd` |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` | S3 (optional, feature returns 503 if empty) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe (optional, feature returns 503 if empty) |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with auto reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npx prisma migrate dev` | Create and apply migrations |
| `npx prisma db seed` | Seed demo data |
| `npm run prisma:studio` | Open Prisma Studio |

### Seed accounts

Password for all: `Password@123`

| Role | Email |
|---|---|
| Admin | `admin@carepulse.test` |
| Doctor | `doctor@carepulse.test` |
| Responder | `responder@carepulse.test` |

The seed also adds three sample hospitals in Dhaka.

## ☁️ Deployment

**Vercel (REST API):** `api/index.ts` and `vercel.json` expose the Express app as a serverless function. Add all environment variables in the Vercel dashboard and keep `postinstall: prisma generate` in `package.json`.

> Vercel does not support persistent WebSockets, so Socket.io only works on a long-running host. The client falls back to 5 second polling on Vercel. For full realtime, deploy this backend to **Render / Railway / a VPS**.

## 🔐 Security

- Passwords hashed with bcrypt (cost 12). Self-registration can only create `PATIENT`.
- Short-lived, signed QR and unlock tokens, plus server-side revocation.
- PIN stored hashed, and PIN attempts limited to 5 per 15 minutes.
- Strict RBAC on every route and per-patient data access checks.
- Zod validation on all inputs, Helmet headers, CORS allow-list.
- Stripe webhook verified by signature.
- Records are never public. Access is through 5 minute presigned URLs.

## 🗺️ Roadmap

- [ ] Audit log for record and QR access
- [ ] Real SMS gateway (Twilio / local provider)
- [ ] Client-side encryption for uploads and KMS envelope keys
- [ ] PostGIS for spatial queries
- [ ] ML / LLM triage model
- [ ] Auto refunds on cancelled paid appointments
- [ ] Local payment gateways (SSLCommerz, bKash)
- [ ] Automated tests and CI (GitHub Actions)

## ⚠️ Disclaimer

The triage engine is an automated screening aid, not a medical diagnosis.

---

<div align="center">Built with ❤️ by <a href="https://github.com/ashrafulislam65">@ashrafulislam65</a></div>
