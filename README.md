# 🍽️ Restaurant Management System (RMS)

A full-stack, feature-rich Restaurant Management System built with **FastAPI**, **React + Vite**, and **MongoDB Atlas**. It provides a dual-interface experience — a customer-facing ordering app and a comprehensive admin dashboard — all deployable on **Render** with a single Blueprint.

---

## ✨ Features

### 👥 Customer App
- Browse live menu with categories, filters, and search
- Table reservations with real-time availability
- Virtual queue management
- Order placement and live order tracking
- Loyalty points, membership plans, and coupon redemption
- Push-style in-app notifications
- Order history and feedback submission
- Secure guest/registered-user authentication

### 🛠️ Admin Dashboard
- **Live Dashboard** — revenue, order stats, table occupancy, staff status (auto-refresh every 10 s)
- **Order Management** — full order lifecycle with KDS (Kitchen Display System) terminal
- **Menu Management** — items, categories, combos, cuisines with image support
- **Table Management** — floor plan, status tracking, waiter assignment
- **Reservation System** — time slots, guest count, waitlist queue
- **Staff Management** — roles, shifts, attendance, payroll, performance logs
- **Inventory** — ingredients, suppliers, purchase orders, deduction tracking
- **Billing & Payments** — invoices, payment methods, delivery zones
- **Offers & Loyalty** — coupons, loyalty config, membership tiers
- **Reports & Analytics** — period-filtered (Today / Week / Month / Year) sales trends, peak hours, staff performance, CSV export
- **Notifications** — push notifications management
- **Security Settings** — roles, permissions, password management, audit logs
- **System Configuration** — restaurant details, logo, contact info, regional settings, Google Drive backups

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11, FastAPI, Motor (async MongoDB), Pydantic v2 |
| **Database** | MongoDB Atlas |
| **Frontend** | React 18, TypeScript, Vite |
| **UI Library** | shadcn/ui, Radix UI, Tailwind CSS |
| **Charts** | Recharts |
| **Auth** | JWT-less session tokens stored in MongoDB |
| **Deployment** | Render (Backend: Web Service, Frontend: Static Site) |

---

## 📁 Project Structure

```
RMS/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py           # App entry point, router registration
│   │   ├── db.py             # MongoDB Motor client
│   │   ├── admin/
│   │   │   └── routes/       # All admin API routes
│   │   └── client/
│   │       └── routes/       # All customer-facing API routes
│   ├── requirements.txt
│   ├── runtime.txt           # python-3.11.11
│   ├── Procfile              # uvicorn start command
│   └── .env.example
│
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── admin/            # Admin dashboard
│   │   └── client/           # Customer app
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
│
├── render.yaml               # Render Blueprint (deploys both services)
├── start.bat                 # Windows local dev launcher
└── README.md
```

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- A MongoDB Atlas cluster (free tier works)

### 1 — Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/rms.git
cd rms
```

### 2 — Backend
```bash
cd backend
cp .env.example .env
# Edit .env — fill in MONGODB_URI and CORS_ORIGINS
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API will be live at `http://localhost:8000`  
Interactive docs at `http://localhost:8000/docs`

### 3 — Frontend
```bash
cd frontend
cp .env.example .env
# Edit .env — set VITE_API_URL=http://localhost:8000
npm install
npm run dev
```
App will be live at `http://localhost:5173`

### Windows shortcut
Double-click `start.bat` — it installs dependencies and starts both servers automatically.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SEED_SECRET` | Secret key for the seed endpoint |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (no trailing slash) |

---

## ☁️ Deploy on Render

This repo includes a **Render Blueprint** (`render.yaml`) that configures both services automatically.

### Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "initial commit"
   git push origin main
   ```

2. **Create a new Blueprint on Render**
   - Go to [render.com](https://render.com) → **New** → **Blueprint**
   - Connect your GitHub repo
   - Render will detect `render.yaml` and create both services

3. **Set environment variables** (Render Dashboard → each service → Environment)

   **rms-api (backend)**
   ```
   MONGODB_URI     = mongodb+srv://...
   CORS_ORIGINS    = https://rms-frontend.onrender.com
   ```

   **rms-frontend (frontend)**
   ```
   VITE_API_URL    = https://rms-api.onrender.com
   ```

4. **Trigger a redeploy** of the frontend after setting `VITE_API_URL` (Vite bakes env vars at build time).

> **Note:** Free tier Render services spin down after 15 minutes of inactivity. The first request after a cold start may take ~30 seconds.

---

## 📡 API Overview

| Prefix | Description |
|---|---|
| `/api/admin/analytics` | Dashboard & report analytics |
| `/api/admin/orders` | Order management |
| `/api/admin/menu` | Menu items, categories, combos |
| `/api/admin/tables` | Table management |
| `/api/admin/staff` | Staff, shifts, attendance, payroll |
| `/api/admin/inventory` | Ingredients, suppliers, purchases |
| `/api/admin/offers` | Coupons, loyalty, memberships |
| `/api/admin/settings` | System config, roles, backups |
| `/api/client/menu` | Public menu |
| `/api/client/orders` | Customer order placement |
| `/api/client/reservations` | Reservation booking |
| `/api/client/queue` | Virtual queue |
| `/api/client/auth` | Customer authentication |

Full interactive API docs available at `/docs` (Swagger UI) and `/redoc`.
