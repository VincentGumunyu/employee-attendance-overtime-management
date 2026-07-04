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
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [License](#-license)

---

## 🌟 Overview

The **Employee Attendance & Overtime Management System** is a modern, full-stack solution designed to help organizations efficiently track employee attendance, manage working hours, and monitor overtime. It supports barcode and RFID-based check-in/check-out scanning, department management, role-based access control, and comprehensive report generation.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **JWT Authentication** | Secure login with role-based access control |
| 👥 **Employee Management** | Add, edit, and manage full employee profiles |
| 🏢 **Department Management** | Organise employees into departments |
| 📡 **Barcode & RFID Scanning** | Real-time attendance check-in/check-out |
| ⏱️ **Overtime Tracking** | Automatic calculation of overtime, late arrivals & early departures |
| 📊 **Dashboard Analytics** | Live overview of attendance and department stats |
| 📄 **Report Generation** | Export detailed attendance and overtime reports as PDF |
| 🪵 **Audit Logs** | Complete audit trail of all system actions |
| 📅 **Shift Configuration** | Configurable shift times and lunch durations |

---

## 🛠️ Tech Stack

### Backend
- **[Flask 3.0](https://flask.palletsprojects.com/)** — Python web framework
- **[Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)** — Database ORM
- **[Flask-JWT-Extended](https://flask-jwt-extended.readthedocs.io/)** — JWT authentication
- **[SQLite](https://www.sqlite.org/)** — Embedded database

### Frontend
- **[React 19](https://react.dev/)** — UI framework
- **[Vite 8](https://vite.dev/)** — Build tool and dev server
- **[React Router v7](https://reactrouter.com/)** — Client-side routing
- **[Bootstrap 5](https://getbootstrap.com/)** — Responsive UI components
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF report generation

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **npm**

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python app.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Quick Start (Windows)

```powershell
.\start.ps1
```

This launches both the backend and frontend in separate terminals.

---

## ⚙️ Configuration

Create a `.env` file inside the `backend/` directory and fill in your environment-specific values. See `config.py` for the list of supported variables.

> ⚠️ Never commit your `.env` file to version control.

---

## 📜 License

This project is licensed under the **MIT License**.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/VincentGumunyu">VincentGumunyu</a>
</p>
