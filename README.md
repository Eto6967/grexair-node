🇬🇧 English · [🇭🇺 Magyar](README_HU.md)

<p align="center">
  <img src="GreexAir/public/logo.png" alt="GrexAir Logo" width="120" style="border-radius:20px">
</p>

<h1 align="center">GrexAir</h1>

<p align="center">
  <b>Intelligent CO₂ monitoring system for enclosed spaces.</b><br>
  <i>Real-time monitoring · Smart ventilation advice · Arduino integration</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-3.0.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white">
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white">
</p>

> 🤖 **AI-assisted development**  This project was built through directed AI development: features, architecture and design decisions were defined by the developer, with implementation guided via prompt engineering. The result is a human-directed, AI-accelerated codebase.

---

## 📸 Screenshot

<p align="center">
  <img src="screenshots/Képernyőkép 2026-05-16 170454.png" alt="GrexAir Dashboard" width="900">
</p>

> *CO₂ Monitoring dashboard live data, colour-coded cards, interactive charts, CO₂ heatmap*

---

## 📖 Overview

**GrexAir** is an IoT solution for continuous air quality monitoring in enclosed spaces such as offices, classrooms and warehouses. Sensor data collected by an Arduino is processed by a Node.js server and displayed in real time on a modern glassmorphism-style web dashboard.

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| 📊 **Real-time dashboard** | Socket.io-powered updates every 3 seconds |
| 🎨 **Dynamic card colours** | Numbers and backgrounds change colour based on CO₂ level |
| 📈 **Min/Max markers** | Dashed reference lines on every chart |
| 🧠 **Kálmán filter** | Noise-free trend line displayed alongside raw measurements |
| ⚡ **Rate of change & acceleration** | Analysis of CO₂ change dynamics |
| 🟢 **Online/Offline indicator** | Automatically switches to OFFLINE after 3 minutes without data |
| 📅 **Archive browser** | Calendar-style date picker modal  click any day to load it |
| 🔍 **Time-based zoom** | All / 1h / 30m / 15m zoom on all charts |
| 🌬️ **Ventilation advice** | Real-time recommendation based on CO₂ level and rate of change |
| 🌡️ **Ventilation speed distribution** | Live chart showing calm / slow / moderate / fast ventilation minutes |
| 🗓️ **CO₂ heatmap** | GitHub-style contribution graph showing daily averages colour-coded by zone |
| 📤 **CSV export** | Download all data with a single click |
| 📄 **PDF report** | Full-page report with interactive chart, statistics, ventilation distribution and AI evaluation |
| 🌙 **Dark / Light theme** | Toggleable on dashboard and PDF report |
| 🌍 **10 languages** | HU · EN · DE · HR · RO · RU · SK · SL · SR · UK |
| 📱 **Responsive design** | Optimised layout for mobile and tablet |

---

## 🖥️ Dashboard components

- **5 KPI cards** Last, Average, Maximum, Minimum, Range
- **Status banner** Colour-coded zone label with current PPM (Excellent / Good / Warning / Critical)
- **CO₂ concentration chart** Raw + Kálmán trend line with time-based zoom
- **Live gauge** Semicircular dial showing real-time PPM value with zone markers
- **Rate of change chart** ppm/min
- **Acceleration chart** Δ rate of change
- **Ventilation status panel** Live state (accelerating / steady / slowing / deteriorating) with colour bar
- **Ventilation speed distribution** Horizontal bars: Calm / Slow / Moderate / Fast minutes per day
- **CO₂ heatmap** Calendar view of the past 26 weeks, coloured by daily average; hover for details
- **Air quality bars** Daily percentage breakdown by zone
- **Event log** Automatic alerts on threshold crossings
- **Ventilation log** Recorded ventilation events with start time, duration and CO₂ drop

---

## 📄 PDF Report

The generated report (accessible from the dashboard) includes:

- **Summary KPI row** Last, Average, Maximum, Minimum, Range
- **Status banner** Zone classification for the day
- **Interactive CO₂ chart**  Drag to select, scroll to zoom, double-click to reset; MAX/MIN labels visible on print
- **Daily statistics table**  Peak time, max, min, average, measurement count
- **Air quality distribution** Colour bars with percentages and minutes
- **Ventilation speed distribution** Table with calm/slow/moderate/fast breakdown
- **Evaluation text**  Auto-generated summary with zone analysis
- **QR code**  Links to the live monitor
- **Dark / Light theme toggle** Inherits the web theme, switchable inside the report

---

## 🌍 Multilingual support

The interface, all dashboard labels, status texts and the PDF report fully adapt to the selected language. Language is stored in a cookie and passed to every page render server-side. Supported:

`Hungarian · English · German · Croatian · Romanian · Russian · Slovak · Slovenian · Serbian · Ukrainian`

---

## 🛠️ Technology stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Node.js + Express.js |
| **Real-time** | Socket.io |
| **Frontend** | EJS + Vanilla JS |
| **Charts** | Chart.js 4.4 + chartjs-plugin-zoom + uPlot |
| **Database** | PostgreSQL  Neon.tech cloud |
| **Signal filter** | Kálmán filter (custom implementation) |
| **Styling** | Custom CSS  glassmorphism, aurora animation |
| **Internationalisation** | JSON locale files + server-side `tr` injection |

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
grexair/
├── server.js           ← Web server, API endpoints, Socket.io, report route
├── dataManager.js      ← DB connection, Kálmán filter, speed buckets, heatmap
├── translations.js     ← Locale loader
├── config.js           ← Threshold values and configuration
├── .env                ← Database URL (not committed to git!)
├── locales/
│   ├── hu.json         ← Hungarian strings
│   ├── en.json         ← English strings
│   └── ...             ← 8 more languages
├── public/
│   ├── css/
│   │   └── grexair.css       ← Full design system
│   ├── js/
│   │   ├── monitor.js        ← Dashboard logic, charts, socket handling
│   │   └── theme.js          ← Dark/light theme management
│   └── logo.png
└── views/
    ├── monitor.ejs     ← Main dashboard (heatmap, speed dist, date modal)
    ├── report.ejs      ← PDF report view
    ├── live.ejs        ← CSV upload page
    └── index.ejs       ← Demo page
```

---

## 🌈 CO₂ levels and colour codes

| CO₂ level | Status | Colour |
| :--- | :--- | :--- |
| < 800 ppm | 🟢 Excellent | Green |
| 800–1000 ppm | 🟡 Good | Yellow |
| 1000–1500 ppm | 🟠 Warning | Orange |
| > 1500 ppm | 🔴 Critical | Red (pulsing) |

---

## 🌬️ Ventilation speed categories

| Category | Speed | Meaning |
| :--- | :--- | :--- |
| 🔴 Calm | < 5 ppm/min | No significant air exchange |
| 🟠 Slow | 5–20 ppm/min | Mild ventilation |
| 🟡 Moderate | 20–60 ppm/min | Active ventilation |
| 🟢 Fast | > 60 ppm/min | Rapid air exchange (open window) |

---

## 🔌 API endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Main dashboard |
| `/api/history` | POST | Historical day data `{ date: "YYYY-MM-DD" }` |
| `/api/heatmap` | GET | Daily averages for the past year (heatmap) |
| `/api/esp32` | GET | Current PPM value for ESP32 displays |
| `/report` | GET | PDF report `?date=YYYY-MM-DD&theme=dark|light` |
| `/demo` | GET | Demo data (SENSOR.CSV) |
| `/upload` | POST | CSV upload and analysis |
| `/set-lang/:lang` | GET | Switch interface language |

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
  <b>GrexAir v3.0 • Open-source IoT project</b><br>
  <i>For healthier indoor air 🌱</i>
</p>
