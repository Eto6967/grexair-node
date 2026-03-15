
<p align="center">
  <img src="GreexAir/public/images/logo.png" alt="GrexAir Logo" width="120" style="border-radius:20px">
</p>

<h1 align="center">GrexAir</h1>

<p align="center">
  <b>Intelligens CO₂ felügyeleti rendszer zárt területekhez.</b><br>
  <i>Valós idejű monitoring · Prediktív analitika · Arduino integráció</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-4.0.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white">
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white">
</p>

---

## 📸 Képernyőkép

> *CO₂ Monitoring dashboard — valós idejű adatok, színkódolt kártyák, Min/Max vonalak*

---

## 📖 Áttekintés

A **GrexAir** egy IoT megoldás zárt területek (irodák, tantermek, raktárak) levegőminőségének folyamatos felügyeletére. Az Arduino szenzor adatait egy Node.js szerver dolgozza fel és egy modern glassmorphism stílusú webes dashboardon jeleníti meg valós időben.

---

## ✨ Funkciók

| Funkció | Leírás |
| :--- | :--- |
| 📊 **Valós idejű dashboard** | Socket.io alapú 3 másodperces frissítés |
| 🎨 **Dinamikus kártyaszínek** | A számok és a kártyák CO₂ szint szerint színeződnek (zöld → sárga → narancs → piros) |
| 📈 **Min/Max jelölők** | Szaggatott piros/zöld vízszintes vonalak minden grafikonon |
| 🧠 **Savitzky-Golay szűrő** | Zajmentes trendvonal a nyers mérések mellett |
| ⚡ **Sebesség & Gyorsulás** | A CO₂ változás dinamikájának elemzése |
| 🟢 **Online/Offline jelző** | 5 perces timeout után automatikusan OFFLINE státusz |
| 📅 **Archívum böngésző** | Korábbi napok adatainak visszakeresése naptárból |
| 📤 **CSV export** | Összes adat letöltése egy kattintással |
| 🌙 **Sötét/Világos téma** | Átkapcsolható, localStorage-ba mentett téma |
| 📱 **Reszponzív design** | Mobil és tablet optimalizált elrendezés |

---

## 🖥️ Dashboard elemek

- **5 KPI kártya** — Jelenlegi, Átlag, Maximum, Minimum, Tartomány
- **CO₂ koncentráció grafikon** — Nyers + Savitzky-Golay trendvonal, zoom gombok
- **Aktuális szint gauge** — Félkör műszerfal valós PPM értékkel
- **Változási sebesség grafikon** — ppm/perc
- **Gyorsulás grafikon** — Δ sebesség változása
- **Időbeli eloszlás** — Vízszintes bar chart kategóriánként
- **Levegőminőség sávok** — Napi százalékos eloszlás
- **Eseménynapló** — Automatikus riasztás küszöbátlépésnél

---

## 🛠️ Technológiai stack

| Réteg | Technológia |
| :--- | :--- |
| **Backend** | Node.js + Express.js |
| **Valós idejű** | Socket.io |
| **Frontend** | EJS + Vanilla JS |
| **Grafikonok** | Chart.js 4.4 |
| **Adatbázis** | PostgreSQL — Neon.tech cloud |
| **Algoritmus** | Savitzky-Golay (`ml-savitzky-golay`) |
| **Stílus** | Egyedi CSS — glassmorphism, aurora animáció |

---

## ⚙️ Telepítés

### Előfeltételek
- Node.js 18+
- Neon PostgreSQL adatbázis ([neon.tech](https://neon.tech))

### 1. Repozitórium klónozása

```bash
git clone https://github.com/Eto6967/grexair-node.git
cd grexair-node
```

### 2. Függőségek telepítése

```bash
npm install
```

### 3. Környezeti változók beállítása

Másold le a `.env.example` fájlt `.env` névvel, majd töltsd ki:

```env
DB_URL=postgresql://felhasznalo:jelszo@ep-valami.neon.tech/adatbazis?sslmode=require
PORT=5000
```

### 4. Szerver indítása

```bash
node server.js
```

Megnyitás: **http://localhost:5000**

---

## 📂 Projektstruktúra

```
GreexAir/
├── server.js          ← Webszerver, API végpontok, Socket.io
├── dataManager.js     ← DB kapcsolat, cache, Savitzky-Golay analízis
├── config.js          ← Küszöbértékek, konfigurációk
├── .env               ← Adatbázis URL (nem kerül git-be!)
├── public/
│   ├── css/
│   │   └── grexair.css      ← Teljes design rendszer
│   ├── js/
│   │   ├── monitor.js       ← Dashboard logika, grafikonok, socket
│   │   ├── main.js          ← Demo és upload oldalak
│   │   └── theme.js         ← Sötét/világos téma kezelés
│   └── logo.png             ← GrexAir logó
└── views/
    ├── monitor.ejs    ← Fő dashboard
    ├── index.ejs      ← Demo oldal
    └── live.ejs       ← CSV feltöltő oldal
```

---

## 🌈 CO₂ szint és színkódok

| CO₂ szint | Státusz | Szín |
| :--- | :--- | :--- |
| < 800 ppm | 🟢 Kiváló | Zöld |
| 800–1000 ppm | 🟡 Jó | Sárga |
| 1000–1200 ppm | 🟠 Elfogadható | Narancs |
| 1200–1500 ppm | 🔴 Figyelem | Narancsvörös |
| > 1500 ppm | 🚨 Veszélyes | Piros (pulzáló) |

---

## 🔌 API végpontok

| Végpont | Metódus | Leírás |
| :--- | :--- | :--- |
| `/` | GET | Fő dashboard |
| `/api/history` | POST | Archív nap adatai `{ date: "YYYY-MM-DD" }` |
| `/api/esp32` | GET | Aktuális PPM — ESP32 kijelzőhöz |
| `/demo` | GET | Demo adatok (SENSOR.CSV) |
| `/upload` | POST | CSV feltöltés és elemzés |

---

## 🔧 Arduino / ESP32 integráció

A szenzor adatokat közvetlenül a Neon PostgreSQL adatbázisba kell küldeni:

```sql
INSERT INTO sensor_data (co2_ppm) VALUES (1250);
```

Az ESP32 az aktuális értéket a `/api/esp32` végpontról kérheti le:

```json
{ "current_co2": 1092 }
```

---

<p align="center">
  <b>GrexAir v4.0 • Nyílt forráskódú IoT projekt</b><br>
  <i>A biztonságosabb beltéri levegőért 🌱</i>
</p>
