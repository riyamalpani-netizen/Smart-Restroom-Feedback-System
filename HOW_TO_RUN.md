# Smart Restroom Feedback System — How to Run

## Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** running on `localhost:5432`
- **npm** (comes with Node.js)

---

## 1. Database Setup (one-time)

Create a PostgreSQL database named `smart_restroom`:

```sql
CREATE DATABASE smart_restroom;
```

The default connection string used by the app is:

```
postgresql://postgres:NewPassword123@localhost:5432/smart_restroom?schema=public
```

If your PostgreSQL password is different, update `DATABASE_URL` in `backend/.env` before proceeding.

---

## 2. Backend Setup

Open a terminal in the `backend` folder:

```powershell
cd backend
npm install
```

### Run Prisma migrations (creates all tables)

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

### Seed the database with demo data + login users

```powershell
node prisma/seed/seedAll.js
```

This creates the demo organization, locations, floors, restrooms, and the four login accounts below.

### (Optional) Seed inventory devices and gateways

```powershell
node prisma/seed/seedInventory.js
```

### (Optional) Open Prisma Studio to view/edit data in browser

```powershell
npm run studio
```

Opens at `http://localhost:5555`

---

## 3. Frontend Setup

Open a **new terminal** in the project root folder:

```powershell
cd "Smart Restroom Feedback System"
npm install
```

---

## 4. Start the Application

You need **two terminals running** — one for the backend, one for the frontend.

### Terminal 1 — Backend (from `backend/` folder)

```powershell
cd backend
npm run dev
```

Server starts on `http://localhost:5000`
API docs available at `http://localhost:5000/api-docs`

### Terminal 2 — Frontend (from project root)

```powershell
npm run dev
```

Frontend starts on `http://localhost:5173`

---

## 5. Login Credentials

Open `http://localhost:5173` in your browser and log in with any of these accounts:

| Role             | Email                            | Password        |
| ---------------- | -------------------------------- | --------------- |
| Super Admin      | superadmin@smartrestroom.com     | SuperAdmin@123  |
| Vendor Admin     | vendor@smartrestroom.com         | Vendor@123      |
| Facility Manager | facility@smartrestroom.com       | Facility@123    |
| Viewer           | viewer@smartrestroom.com         | Viewer@123      |

> If you seeded using `seedDashboardData.js` instead of `seedAll.js`, the super admin account is:
>
> | Role        | Email                      | Password   |
> | ----------- | -------------------------- | ---------- |
> | Super Admin | admin@smartrestroom.com    | Admin@123  |

---

## 6. Useful Commands Reference

| Task                         | Folder   | Command                              |
| ---------------------------- | -------- | ------------------------------------ |
| Install backend dependencies | backend  | `npm install`                        |
| Generate Prisma client       | backend  | `npx prisma generate`                 |
| Run migrations               | backend  | `npx prisma migrate dev`             |
| Seed all demo data           | backend  | `node prisma/seed/seedAll.js`        |
| Seed inventory only          | backend  | `node prisma/seed/seedInventory.js`  |
| Create admin user only       | backend  | `node prisma/seed/createAdmin.js`    |
| Open Prisma Studio           | backend  | `npm run studio`                     |
| Start backend (dev)          | backend  | `npm run dev`                        |
| Start backend (production)   | backend  | `npm start`                          |
| Run backend tests            | backend  | `npm test`                           |
| Install frontend deps        | root     | `npm install`                        |
| Start frontend (dev)         | root     | `npm run dev`                        |
| Build frontend for prod      | root     | `npm run build`                      |
| Preview production build     | root     | `npm run preview`                    |
| Run frontend tests           | root     | `npm test`                           |

---

## 7. Environment Variables

The backend reads configuration from `backend/.env`. Key variables:

| Variable              | Description                           |
| --------------------- | ------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string          |
| `JWT_SECRET`          | Secret used to sign login tokens      |
| `PORT`                | Backend port (default 5000)          |
| `TTN_API_BASE_URL`    | TTN cluster API base URL              |
| `TTN_APPLICATION_ID`  | TTN application ID                    |
| `TTN_API_KEY`         | TTN application API key               |
| `TTN_MQTT_BROKER`     | TTN MQTT broker host                  |
| `TTN_MQTT_USERNAME`   | TTN MQTT username                     |
| `TTN_MQTT_PASSWORD`   | TTN MQTT password (API key)           |
| `TTN_MQTT_TOPIC`      | TTN MQTT subscription topic           |
| `TEAMS_WEBHOOK_URL`   | Microsoft Teams alert webhook URL     |

See `backend/.env.example` for the full list with descriptions.

---

## 8. Stopping the Application

Press `Ctrl + C` in each terminal to stop the running process.

---

## 9. Resetting the Database

To drop all data and re-run migrations from scratch:

```powershell
cd backend
npx prisma migrate reset
node prisma/seed/seedAll.js
```
