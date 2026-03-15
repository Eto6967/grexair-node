🇬🇧 [English](README.md) · 🇭🇺 [Magyar](README_HU.md)
<p align="center">
  <img src="GreexAir/public/images/logo.png" alt="GrexAir Logo" width="120" style="border-radius:20px">
</p>

<h1 align="center">GrexAir</h1>

<p align="center">
  <b>Intelligent CO₂ monitoring system for enclosed spaces.</b><br>
  <i>Real-time monitoring · Predictive analytics · Arduino integration</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-4.0.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white">
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white">
</p>

---

## 📸 Screenshot

> *CO₂ Monitoring dashboard — live data, colour-coded cards, Min/Max reference lines*

---

## 📖 Overview

**GrexAir** is an IoT solution for continuous air quality monitoring in enclosed spaces such as offices, classrooms and warehouses. Sensor data collected by an Arduino is processed by a Node.js server and displayed in real time on a modern glassmorphism-style web dashboard.

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| 📊 **Real-time dashboard** | Socket.io-powered updates every 3 seconds |
| 🎨 **Dynamic card colours** | Numbers and card backgrounds change colour based on CO₂ level (green → yellow → orange → red) |
| 📈 **Min/Max markers** | Dashed red/green horizontal reference lines on every chart |
| 🧠 **Savitzky-Golay filter** | Noise-free trend line displayed alongside raw measurements |
| ⚡ **Rate of change & acceleration** | Analysis of CO₂ change dynamics |
| 🟢 **Online/Offline indicator** | Automatically switches to OFFLINE after a 5-minute data timeout |
| 📅 **Archive browser** | Look up historical data from any previous day via a date picker |
| 📤 **CSV export** | Download all data with a single click |
| 🌙 **Dark / Light theme** | Toggleable theme saved to localStorage |
| 📱 **Responsive design** | Optimised layout for mobile and tablet |

---

## 🖥️ Dashboard components

- **5 KPI cards** — Current, Average, Maximum, Minimum, Range
- **CO₂ concentration chart** — Raw + Savitzky-Golay trend line with zoom controls
- **Live gauge** — Semicircular dial showing real-time PPM value
- **Rate of change chart** — ppm/min
- **Acceleration chart** — Δ rate of change
- **Time distribution chart** — Horizontal bar chart by category
- **Air quality bars** — Daily percentage breakdown
- **Event log** — Automatic alerts on threshold crossings

---

## 🛠️ Technology stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Node.js + Express.js |
| **Real-time** | Socket.io |
| **Frontend** | EJS + Vanilla JS |
| **Charts** | Chart.js 4.4 |
| **Database** | PostgreSQL — Neon.tech cloud |
| **Algorithm** | Savitzky-Golay (`ml-savitzky-golay`) |
| **Styling** | Custom CSS — glassmorphism, aurora animation |

---

## ⚙️ Installation

### Prerequisites
- Node.js 18+
- Neon PostgreSQL database ([neon.tech](https://neon.tech))

### 1. Clone the repository

```bash
git clone https://github.com/Eto6967/grexair-node.git
cd grexair-node
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
DB_URL=postgresql://user:password@ep-something.neon.tech/dbname?sslmode=require
PORT=5000
```

### 4. Start the server

```bash
node server.js
```

Open in browser: **http://localhost:5000**

---

## 📂 Project structure

```
GreexAir/
├── server.js          ← Web server, API endpoints, Socket.io
├── dataManager.js     ← DB connection, caching, Savitzky-Golay analysis
├── config.js          ← Threshold values and configuration
├── .env               ← Database URL (not committed to git!)
├── public/
│   ├── css/
│   │   └── grexair.css      ← Full design system
│   ├── js/
│   │   ├── monitor.js       ← Dashboard logic, charts, socket handling
│   │   ├── main.js          ← Demo and upload pages
│   │   └── theme.js         ← Dark/light theme management
│   └── logo.png             ← GrexAir logo
└── views/
    ├── monitor.ejs    ← Main dashboard
    ├── index.ejs      ← Demo page
    └── live.ejs       ← CSV upload page
```

---

## 🌈 CO₂ levels and colour codes

| CO₂ level | Status | Colour |
| :--- | :--- | :--- |
| < 800 ppm | 🟢 Excellent | Green |
| 800–1000 ppm | 🟡 Good | Yellow |
| 1000–1200 ppm | 🟠 Acceptable | Orange |
| 1200–1500 ppm | 🔴 Warning | Red-orange |
| > 1500 ppm | 🚨 Dangerous | Red (pulsing) |

---

## 🔌 API endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Main dashboard |
| `/api/history` | POST | Historical day data `{ date: "YYYY-MM-DD" }` |
| `/api/esp32` | GET | Current PPM value — for ESP32 displays |
| `/demo` | GET | Demo data (SENSOR.CSV) |
| `/upload` | POST | CSV upload and analysis |

---

## 🔧 Arduino / ESP32 integration

Sensor readings should be written directly to the Neon PostgreSQL database:

```sql
INSERT INTO sensor_data (co2_ppm) VALUES (1250);
```

An ESP32 display can poll the current value from the `/api/esp32` endpoint:

```json
{ "current_co2": 1092 }
```

---

<p align="center">
  <b>GrexAir v4.0 • Open-source IoT project</b><br>
  <i>For healthier indoor air 🌱</i>
</p>
