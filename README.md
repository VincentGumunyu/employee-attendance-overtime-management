<h1 align="center">
  🕐 Employee Attendance & Overtime Management System
</h1>

<p align="center">
  A full-stack web application for managing employee attendance, overtime tracking, barcode/RFID scanning, and generating detailed workforce reports.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Flask-3.0.0-black?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-Auth-FF6B35?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Quick Start (Windows)](#quick-start-windows)
- [Configuration](#-configuration)
- [API Overview](#-api-overview)
- [Usage](#-usage)
- [License](#-license)

---

## 🌟 Overview

The **Employee Attendance & Overtime Management System** is a modern, full-stack solution designed to help organizations efficiently track employee attendance, manage working hours, and monitor overtime. It supports barcode and RFID-based check-in/check-out scanning, department management, role-based access control, and comprehensive PDF/Excel report generation.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **JWT Authentication** | Secure login with role-based access (Admin, Security, HR) |
| 👥 **Employee Management** | Add, edit, and manage employee profiles with full details |
| 🏢 **Department Management** | Organize employees into departments |
| 📡 **Barcode & RFID Scanning** | Real-time attendance check-in/check-out via barcode or RFID |
| ⏱️ **Overtime Tracking** | Automatic calculation of overtime, late arrivals & early departures |
| 📊 **Dashboard Analytics** | Live overview of today's attendance, absences, and department stats |
| 📄 **Report Generation** | Export detailed attendance and overtime reports as PDF |
| 🪵 **Audit Logs** | Complete audit trail of all system actions |
| 📅 **Shift Configuration** | Configurable shift start/end times and lunch durations |

---

## 🛠️ Tech Stack

### Backend
- **[Flask 3.0](https://flask.palletsprojects.com/)** — Lightweight Python web framework
- **[Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)** — ORM for database interactions
- **[Flask-JWT-Extended](https://flask-jwt-extended.readthedocs.io/)** — JWT-based authentication
- **[Flask-CORS](https://flask-cors.readthedocs.io/)** — Cross-origin resource sharing
- **[SQLite](https://www.sqlite.org/)** — Embedded database (configurable to MySQL/PostgreSQL)
- **[python-dotenv](https://pypi.org/project/python-dotenv/)** — Environment variable management

### Frontend
- **[React 19](https://react.dev/)** — Component-based UI framework
- **[Vite 8](https://vite.dev/)** — Lightning-fast build tool and dev server
- **[React Router v7](https://reactrouter.com/)** — Client-side routing
- **[Bootstrap 5](https://getbootstrap.com/)** — Responsive UI components
- **[Axios](https://axios-http.com/)** — HTTP client for API communication
- **[JsBarcode](https://github.com/lindell/JsBarcode)** — Barcode generation
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF report generation
- **[Lucide React](https://lucide.dev/)** — Clean icon library

---

## 📁 Project Structure

```
employee-attendance-overtime-management/
│
├── backend/                    # Flask REST API
│   ├── app.py                  # Application factory & entry point
│   ├── config.py               # Configuration (shift times, DB, JWT)
│   ├── models.py               # SQLAlchemy database models
│   ├── routes.py               # All API route definitions
│   ├── services.py             # Business logic layer
│   ├── extensions.py           # Flask extension instances
│   ├── seed.py                 # Database seeding script
│   ├── add_security_user.py    # Utility to add security users
│   └── requirements.txt        # Python dependencies
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── pages/              # Page-level components
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Employees.jsx
│   │   │   ├── Departments.jsx
│   │   │   ├── AttendanceScanner.jsx
│   │   │   └── Reports.jsx
│   │   ├── components/
│   │   │   └── Sidebar.jsx     # Navigation sidebar
│   │   ├── lib/
│   │   │   └── api.js          # Axios API client
│   │   ├── App.jsx             # Root component & routing
│   │   └── main.jsx            # Application entry point
│   ├── package.json
│   └── vite.config.js
│
├── start.ps1                   # Windows quick-start script
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** — [Download](https://git-scm.com/)

---

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create a .env file (see Configuration section)
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# 5. Seed the database with initial data (optional)
python seed.py

# 6. Start the Flask server
python app.py
```

> The backend will run on **http://localhost:5000**

---

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

> The frontend will run on **http://localhost:5173**

---

### Quick Start (Windows)

A PowerShell script is included to start both services simultaneously:

```powershell
# From the project root
.\start.ps1
```

This will open two terminal windows — one for the backend and one for the frontend.

---

## ⚙️ Configuration

Create a `.env` file inside the `backend/` directory:

```env
# Flask
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///hospital.db

# JWT
JWT_SECRET_KEY=your-jwt-secret-key-here

# Shift Settings
SHIFT_START_TIME=08:00:00
SHIFT_END_TIME=17:00:00
LUNCH_DURATION_MINUTES=60
DAILY_REQUIRED_HOURS=8
WEEKLY_REQUIRED_HOURS=40
```

> **Note:** For production, replace SQLite with MySQL or PostgreSQL by updating `DATABASE_URL`.

---

## 📡 API Overview

All API endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User login — returns JWT token |
| `GET` | `/api/employees` | List all employees |
| `POST` | `/api/employees` | Create a new employee |
| `PUT` | `/api/employees/:id` | Update employee details |
| `DELETE` | `/api/employees/:id` | Delete an employee |
| `GET` | `/api/departments` | List all departments |
| `POST` | `/api/scan` | Process a barcode/RFID scan |
| `GET` | `/api/attendance` | Fetch attendance records |
| `GET` | `/api/reports` | Generate attendance/overtime reports |
| `GET` | `/api/audit-logs` | View system audit logs |
| `GET` | `/health` | Health check endpoint |

---

## 📖 Usage

### Default Admin Login
After seeding the database, log in with the default admin credentials:

```
Username: admin
Password: admin123
```

> ⚠️ **Change the default password immediately after first login in a production environment.**

### Scanning Attendance
1. Navigate to **Attendance Scanner** in the sidebar
2. Use a barcode scanner or RFID reader connected to your device
3. The system automatically records check-in or check-out based on the last scan

### Generating Reports
1. Go to the **Reports** section
2. Select a date range and filter by department or employee
3. Click **Export PDF** to download the report

---

## 📜 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/VincentGumunyu">VincentGumunyu</a>
</p>
