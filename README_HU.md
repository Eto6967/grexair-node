[🇬🇧 English](README.md) · 🇭🇺 Magyar

<p align="center">
  <img src="public/logo.png" alt="GrexAir Logo" width="120" style="border-radius:20px">
</p>

<h1 align="center">GrexAir</h1>

<p align="center">
  <b>Intelligens CO₂ felügyeleti rendszer zárt területekhez.</b><br>
  <i>Valós idejű monitoring · Szellőztetési javaslat · Arduino integráció</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-3.0.0-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white">
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white">
</p>

> 🤖 **AI-irányított fejlesztés**  A projektet irányított AI-fejlesztéssel készítettük: a funkciókat, az architektúrát és a design döntéseket a fejlesztő határozta meg, a megvalósítást prompt engineering segítségével vezérelve. Az eredmény egy ember által irányított, AI-gyorsított kódbázis.

---

## 📸 Képernyőkép

<p align="center">
  <img src="screenshots/Képernyőkép 2026-05-16 170454.png" alt="GrexAir Dashboard" width="900">
</p>

> *CO₂ Monitoring dashboard  valós idejű adatok, színkódolt kártyák, interaktív grafikonok, CO₂ hőtérkép*

---

## 📖 Áttekintés

A **GrexAir** egy IoT megoldás zárt területek (irodák, tantermek, raktárak) levegőminőségének folyamatos felügyeletére. Az Arduino szenzor adatait egy Node.js szerver dolgozza fel és egy modern glassmorphism stílusú webes dashboardon jeleníti meg valós időben.

---

## ✨ Funkciók

| Funkció | Leírás |
| :--- | :--- |
| 📊 **Valós idejű dashboard** | Socket.io alapú 3 másodperces frissítés |
| 🎨 **Dinamikus kártyaszínek** | A számok és háttérek CO₂ szint szerint színeződnek |
| 📈 **Min/Max jelölők** | Szaggatott referencia vonalak minden grafikonon |
| 🧠 **Kálmán szűrő** | Zajmentes trendvonal a nyers mérések mellett |
| ⚡ **Sebesség & Gyorsulás** | A CO₂ változás dinamikájának elemzése |
| 🟢 **Online/Offline jelző** | 3 perces adathiány után automatikusan OFFLINE státusz |
| 📅 **Archívum böngésző** | Naptár stílusú dátumválasztó modal  kattints bármelyik napra |
| 🔍 **Időalapú zoom** | Összes / 1ó / 30p / 15p zoom minden grafikonon |
| 🌬️ **Szellőztetési javaslat** | Valós idejű javaslat a CO₂ szint és trend alapján |
| 🌡️ **Szellőzési sebesség eloszlás** | Élő kártya: nyugodt / lassú / közepes / gyors percek |
| 🗓️ **CO₂ hőtérkép** | GitHub-stílusú naptárnézet az elmúlt 26 hét napi átlagaival, zóna szerint színezve |
| 📤 **CSV export** | Összes adat letöltése egy kattintással |
| 📄 **PDF riport** | Teljes oldalas riport interaktív grafikonnal, statisztikákkal, szellőzési eloszlással és AI értékeléssel |
| 🌙 **Sötét / Világos téma** | Átkapcsolható a dashboardon és a PDF riportban egyaránt |
| 🌍 **10 nyelv** | HU · EN · DE · HR · RO · RU · SK · SL · SR · UK |
| 📱 **Reszponzív design** | Mobil és tablet optimalizált elrendezés |

---

## 🖥️ Dashboard elemek

- **5 KPI kártya**  Utolsó, Átlag, Maximum, Minimum, Tartomány
- **Státusz csík**  Zóna felirat az aktuális PPM értékkel (Kiváló / Jó / Figyelem / Kritikus)
- **CO₂ koncentráció grafikon** Nyers + Kálmán trendvonal időalapú zoommal
- **Aktuális szint gauge**  Félkör műszerfal valós PPM értékkel és zóna jelölőkkel
- **Sebesség grafikon**  ppm/perc
- **Gyorsulás grafikon**  Δ sebesség változása
- **Szellőzési állapot panel** Élő állapot (gyorsuló / egyenletes / lassuló / romló) színes sávval
- **Szellőzési sebesség eloszlás**  Vízszintes sávok: Nyugodt / Lassú / Közepes / Gyors percek naponta
- **CO₂ hőtérkép**  Az elmúlt 26 hét naptárnézete, napi átlag szerint színezve; rámutatva részletek
- **Levegőminőség sávok**  Napi százalékos eloszlás zónánként
- **Eseménynapló**  Automatikus riasztás küszöbátlépésnél
- **Szellőztetési napló**  Rögzített szellőztetési események időponttal, időtartammal és CO₂ csökkenéssel

---

## 📄 PDF Riport

A dashboardról elérhető generált riport tartalmazza:

- **KPI összefoglaló sor** Utolsó, Átlag, Maximum, Minimum, Tartomány
- **Státusz csík** A nap zóna besorolása
- **Interaktív CO₂ grafikon** Húzd a kijelöléshez, görgesd a zoomhoz, dupla klikk a visszaállításhoz; MAX/MIN feliratok nyomtatáson is láthatók
- **Napi statisztika tábla**  Csúcs ideje, max, min, átlag, mérésszám
- **Levegőminőség eloszlás** Színes sávok százalékkal és percekkel
- **Szellőzési sebesség eloszlás**  Tábla nyugodt/lassú/közepes/gyors bontással
- **Értékelés szöveg** Automatikusan generált összefoglaló zóna elemzéssel
- **QR kód** Az élő monitorra mutató hivatkozás
- **Sötét / Világos téma váltó** Átveszi a webes témát, a riportban is váltható

---

## 🌍 Többnyelvű támogatás

A felület, az összes dashboard felirat, státusz szöveg és a PDF riport teljes egészében a kiválasztott nyelvhez igazodik. A nyelv cookie-ban tárolódik és szerver oldalon kerül be minden oldal renderelésébe. Támogatott nyelvek:

`Magyar · Angol · Német · Horvát · Román · Orosz · Szlovák · Szlovén · Szerb · Ukrán`

---

## 🛠️ Technológiai stack

| Réteg | Technológia |
| :--- | :--- |
| **Backend** | Node.js + Express.js |
| **Valós idejű** | Socket.io |
| **Frontend** | EJS + Vanilla JS |
| **Grafikonok** | Chart.js 4.4 + chartjs-plugin-zoom + uPlot |
| **Adatbázis** | PostgreSQL Neon.tech cloud |
| **Jelszűrő** | Kálmán szűrő (saját implementáció) |
| **Stílus** | Egyedi CSS glassmorphism, aurora animáció |
| **Többnyelvűség** | JSON locale fájlok + szerver oldali `tr` injektálás |

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
grexair/
├── server.js           ← Webszerver, API végpontok, Socket.io, riport route
├── dataManager.js      ← DB kapcsolat, Kálmán szűrő, sebesség bucket, hőtérkép
├── translations.js     ← Locale betöltő
├── config.js           ← Küszöbértékek, konfigurációk
├── .env                ← Adatbázis URL (nem kerül git-be!)
├── locales/
│   ├── hu.json         ← Magyar szövegek
│   ├── en.json         ← Angol szövegek
│   └── ...             ← 8 további nyelv
├── public/
│   ├── css/
│   │   └── grexair.css       ← Teljes design rendszer
│   ├── js/
│   │   ├── monitor.js        ← Dashboard logika, grafikonok, socket
│   │   └── theme.js          ← Sötét/világos téma kezelés
│   └── logo.png
└── views/
    ├── monitor.ejs     ← Fő dashboard (hőtérkép, sebesség eloszlás, dátum modal)
    ├── report.ejs      ← PDF riport nézet
    ├── live.ejs        ← CSV feltöltő oldal
    └── index.ejs       ← Demo oldal
```

---

## 🌈 CO₂ szint és színkódok

| CO₂ szint | Státusz | Szín |
| :--- | :--- | :--- |
| < 800 ppm | 🟢 Kiváló | Zöld |
| 800–1000 ppm | 🟡 Jó | Sárga |
| 1000–1500 ppm | 🟠 Figyelem | Narancs |
| > 1500 ppm | 🔴 Kritikus | Piros (pulzáló) |

---

## 🌬️ Szellőzési sebesség kategóriák

| Kategória | Sebesség | Jelentés |
| :--- | :--- | :--- |
| 🔴 Nyugodt | < 5 ppm/perc | Nincs érdemi légcsere |
| 🟠 Lassú | 5–20 ppm/perc | Enyhe szellőzés |
| 🟡 Közepes | 20–60 ppm/perc | Aktív szellőzés |
| 🟢 Gyors | > 60 ppm/perc | Gyors légcsere (nyitott ablak) |

---

## 🔌 API végpontok

| Végpont | Metódus | Leírás |
| :--- | :--- | :--- |
| `/` | GET | Fő dashboard |
| `/api/history` | POST | Archív nap adatai `{ date: "YYYY-MM-DD" }` |
| `/api/heatmap` | GET | Napi átlagok az elmúlt évre (hőtérkép) |
| `/api/esp32` | GET | Aktuális PPM  ESP32 kijelzőhöz |
| `/report` | GET | PDF riport `?date=ÉÉÉÉ-HH-NN&theme=dark|light` |
| `/demo` | GET | Demo adatok (SENSOR.CSV) |
| `/upload` | POST | CSV feltöltés és elemzés |
| `/set-lang/:lang` | GET | Felület nyelvének váltása |

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
  <b>GrexAir v3.0 • Nyílt forráskódú IoT projekt</b><br>
  <i>A biztonságosabb beltéri levegőért 🌱</i>
</p>
