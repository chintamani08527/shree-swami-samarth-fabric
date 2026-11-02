# Shree Swami Samarth Fabric — Smart Attendance Management System

A production-ready, mobile-first web application engineered specifically for **Shree Swami Samarth Fabric**, a textile manufacturing enterprise. The system allows factory workers to mark their own attendance via mobile phones using authoritative server timestamps, while floor supervisors and administrative managers monitor live presence, manage departments and shifts, perform authorized corrections with full audit logging, and download weekly Excel reports formatted with ExcelJS.

---

## 1. Technology Stack

- **Frontend:** React 18 with TypeScript, Tailwind CSS, Vite, Lucide React, Recharts, and Canvas-Confetti.
- **Backend:** Node.js (v20+) with Express.js (ESM), TypeScript, and Zod request validation.
- **Database & ORM:** PostgreSQL with Prisma ORM (`prisma/schema.prisma`), foreign keys, cascading rules, unique constraints, and database transactions. (Zero-config SQLite dual schema is also included for zero-dependency offline local test runs).
- **Authentication:** Secure session cookies (HTTP-only) and JWT Bearer authorization with bcryptjs password and PIN hashing.
- **Reporting & Export:** ExcelJS for `.xlsx` reports with corporate headers, company branding, multi-sheet views, totals rows, and cell formatting.
- **Timezone:** Standardized on `Asia/Kolkata` (IST +05:30) with UTC storage in PostgreSQL.
- **Containerization:** Multi-stage `Dockerfile` and `docker-compose.yml` with PostgreSQL 16 and automated daily backup volume management.

---

## 2. System Architecture & Roles

```
                                  +----------------------------------+
                                  |    Shree Swami Samarth Fabric    |
                                  |     Smart Attendance Portal      |
                                  +-----------------+----------------+
                                                    |
             +--------------------------------------+--------------------------------------+
             |                                      |                                      |
             v                                      v                                      v
  +----------------------+               +-----------------------+              +----------------------+
  |   Worker Dashboard   |               | Supervisor Dashboard  |              |   Admin Dashboard    |
  |    (Mobile-First)    |               |    (Floor-Scoped)     |              |     (Full Suite)     |
  +----------------------+               +-----------------------+              +----------------------+
  | * Tap to Check In    |               | * Assigned Dept Floor |              | * Real-time 6 KPI    |
  | * Tap to Check Out   |               | * Live Checked-In     |              |   Metric Cards       |
  | * Live Floor Timer   |               | * Exception Monitor   |              | * 7-Day Trend Charts |
  | * Today Status Badge |               | * Department Turnout  |              | * Worker Management  |
  | * Weekly Hours Card  |               | * No Admin Settings   |              | * Attendance Audit   |
  | * Personal History   |               |   or Account Deletion |              | * ExcelJS Download   |
  | * Anti-Tamper Clock  |               +-----------------------+              | * Shifts & Settings  |
  +----------------------+                                                      +----------------------+
```

### A. Worker Dashboard (Mobile-First)
- **Main Interface:** Personalized greeting ("Namaste, Pandurang Shinde"), current date, live ticking clock in IST, and today's attendance status.
- **Big Touch Targets:** Large glowing **Check In** button and **Check Out** button. Check-in triggers celebratory confetti visual feedback.
- **Live Active Working Duration:** Ticking timer displayed while on the factory floor.
- **Restrictions:** Strict role separation prevents workers from editing timestamps, marking attendance for other workers, or accessing supervisor/admin routes.

### B. Admin Dashboard
- **KPI Overview:** 6 real-time cards: Registered Workers, Present Today, Absent Today, Currently Checked In (with pulsating live radar beacon), Late Arrivals, and Total Productive Working Hours.
- **Analytics Charts:** Recharts 7-Day Attendance and Productive Hours trend area chart, plus department turnout percentage bars.
- **Attendance Monitoring:** Live toggle between all historical logs and currently checked-in workers. Missing check-out detection banner.
- **Authorized Corrections:** Edit timestamps or status with a **mandatory written reason** (minimum 5 characters) and automated audit trail logging.
- **Worker Management:** Add new workers with unique Worker IDs (e.g. `SSF-101`), assign departments and shifts, update profiles, reset PINs securely, and deactivate profiles with reason logging.
- **Department Management:** Manage Weaving, Jacquard, Spinning, Dyeing & Printing, Quality Control, and Maintenance & Utility.
- **Settings & Shifts:** Configure grace periods (default 15m), break durations (default 60m), break deduction threshold (default 5 hrs), overtime thresholds, and shift schedules.
- **Security & Compliance Audit Trail:** Immutable log recording Actor, Action, Entity, Timestamp, and stated Reason.

### C. Supervisor Dashboard
- Scoped to supervisor's assigned factory department (e.g. Weaving floor).
- Live floor presence of active operators, exception tracking, and department turnout stats without access to admin account configurations.

---

## 3. Weekly Excel Report (`ExcelJS`)

The system exports `.xlsx` files generated directly from the PostgreSQL database records:
- **Sheet 1: Weekly Summary**
  - Company Header banner in Deep Navy (`#1B3A5D`) with white typography.
  - Subtitle with selected reporting period and generation timestamp.
  - Columns: Worker ID, Worker Name, Department, Shift, Days Present, Days Late, Days Absent, Break Duration (Mins), Total Working Hours, Overtime Hours, Attendance %.
  - Totals row with double-underline border formatting and aggregate numbers.
  - Native Excel AutoFilter enabled across all columns.
- **Sheet 2: Detailed Daily Logs**
  - Individual daily timestamps for every worker across the 7 days of the week.
  - Check-in time, Check-out time, Break duration, Working hours, Attendance status, and Late/Exception indicator.
  - Status color coding (Green for PRESENT, Amber for LATE, Orange for HALF_DAY, Red for ABSENT).

---

## 4. Default Credentials (Seeded)

The database seed includes realistic sample accounts for evaluation:

| Role | Worker ID | Name | Department | Password / PIN |
|---|---|---|---|---|
| **Admin (Owner)** | `vinayak4501` | Vinayak Ginde (admin) | Factory Management | `swami@4501` |
| **Supervisor** | `SUP-001` | Suresh Deshmukh | Weaving | `super123` |
| **Worker (Checked In)** | `SSF-101` | Pandurang Shinde | Weaving | `1001` |
| **Worker (Checked In)** | `SSF-102` | Ananda More | Jacquard | `1002` |
| **Worker (Late)** | `SSF-103` | Dattatray Kadam | Weaving | `1003` |
| **Worker (Completed Shift)** | `SSF-104` | Santosh Gaikwad | Spinning | `1004` |
| **Worker (Fresh Day - Tap Check In)** | `SSF-106` | Sunil Jadhav | Quality Control | `1006` |

*Note: The login screen also includes convenient one-click "Quick Test Accounts" buttons to test each role instantly.*

---

## 5. Local Development Setup

### Prerequisites
- Node.js (v18, v20, or v22+)
- npm (v9+)

### Installation
```bash
# 1. Clone or navigate to the project directory
cd shree-swami-samarth-fabric

# 2. Install all dependencies (server and client)
npm run install:all
```

### Environment Configuration
The server `.env` file is located at `server/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
# For production PostgreSQL:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fabric_attendance?schema=public"
JWT_SECRET="shree-swami-samarth-fabric-super-secure-jwt-key-2026-attendance"
JWT_EXPIRES_IN="7d"
COMPANY_TIMEZONE="Asia/Kolkata"
COMPANY_NAME="Shree Swami Samarth Fabric"
CORS_ORIGIN="http://localhost:5173"
```

### Database Push & Seed
```bash
# Synchronize database schema
npm --prefix server run prisma:push

# Seed database with sample factory data, departments, shifts, workers, and past records
npm --prefix server run prisma:seed
```

### Running in Development
```bash
# Run server (port 5000)
npm run dev:server

# In a separate terminal, run frontend (port 5173 with proxy to backend)
npm run dev:client
```
Visit `http://localhost:5173` in your browser.

---

## 6. Running Test Suite

The project includes an automated test suite verifying:
- Working hours calculations and break deductions
- Grace period and late arrival logic
- Overtime calculations
- Authentication and case-insensitive worker ID login
- Duplicate check-in prevention
- Checkout restrictions
- Live dashboard KPI aggregations
- ExcelJS spreadsheet buffer generation

```bash
# Run the test suite
npm test
```

---

## 7. Production Build & Deployment

### Production Single-Port Serving
The Express server is configured to serve the compiled React frontend directly:

```bash
# Build both frontend and backend
npm run build

# Start the unified production server
npm --prefix server start
```
The application will be live at `http://localhost:5000`.

### Docker & Docker Compose Deployment (PostgreSQL 16)
To run in a containerized environment with PostgreSQL and automated database backups:

```bash
# Start PostgreSQL, Application, and Backup services
docker compose up -d --build

# Run database migration & seed inside the container
docker compose exec app npm --prefix server run prisma:push
docker compose exec app npm --prefix server run prisma:seed
```

---

## 8. Database Backup & Disaster Recovery

### Automated Backups
The included `db-backup` container performs daily automated PostgreSQL dumps into `./backups`:
- Backups retention: Daily backups kept for 30 days, weekly for 4 weeks, monthly for 12 months.

### Manual Backup Command
To trigger an immediate PostgreSQL database dump:
```bash
docker exec -t ssf_attendance_postgres pg_dump -U postgres fabric_attendance > backup_manual_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore Procedure
To restore from a backup SQL file:
```bash
# 1. Terminate active sessions
docker exec -i ssf_attendance_postgres psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'fabric_attendance';"

# 2. Drop and recreate database
docker exec -i ssf_attendance_postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS fabric_attendance;"
docker exec -i ssf_attendance_postgres psql -U postgres -d postgres -c "CREATE DATABASE fabric_attendance;"

# 3. Restore backup
cat backup_manual.sql | docker exec -i ssf_attendance_postgres psql -U postgres -d fabric_attendance
```

---

## 9. Directory Structure

```
shree-swami-samarth-fabric/
├── Dockerfile                  # Multi-stage production Docker build
├── docker-compose.yml          # App + PostgreSQL 16 + Automated Backup Service
├── package.json                # Monorepo root scripts
├── README.md                   # Complete system documentation
├── server/                     # Backend (Node.js, Express, TypeScript, Prisma, ExcelJS)
│   ├── prisma/
│   │   ├── schema.prisma       # PostgreSQL Prisma schema with enums & relations
│   │   ├── schema.sqlite.prisma# SQLite dual schema for zero-dependency local runs
│   │   └── seed.ts             # Realistic factory seed script
│   ├── src/
│   │   ├── config/             # Environment, company defaults, and constants
│   │   ├── db/                 # Prisma client singleton
│   │   ├── middleware/         # Auth, RBAC, Zod validation, error handler, audit logger
│   │   ├── routes/             # REST endpoints (auth, workers, attendance, reports, etc.)
│   │   ├── services/           # Business logic, attendance calculations, ExcelJS service
│   │   ├── utils/              # Asia/Kolkata timezone and shift calculation helpers
│   │   ├── app.ts              # Express application setup
│   │   └── server.ts           # Server bootstrap
│   ├── tests/                  # Test suite (vitest)
│   ├── tsconfig.json
│   └── package.json
└── client/                     # Frontend (React 18, TypeScript, Tailwind CSS, Vite)
    ├── src/
    │   ├── components/
    │   │   ├── common/         # Logo, LiveClock, StatusBadge, Modal, Toast
    │   │   └── layout/         # Navbar, Sidebar, WorkerBottomNav, Layout
    │   ├── context/            # AuthContext, ToastContext
    │   ├── pages/
    │   │   ├── auth/           # Login screen with quick test credential pills
    │   │   ├── worker/         # Mobile-first worker attendance interface
    │   │   ├── admin/          # Admin Dashboard, Attendance, Workers, Reports, etc.
    │   │   └── supervisor/     # Floor Supervisor scoped dashboard
    │   ├── services/           # REST API client
    │   ├── types/              # Shared TypeScript definitions
    │   ├── App.tsx             # Role-based view router
    │   ├── main.tsx
    │   └── index.css
    ├── index.html
    ├── tailwind.config.js
    ├── vite.config.ts
    ├── tsconfig.json
    └── package.json
```
