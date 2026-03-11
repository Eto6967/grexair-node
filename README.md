<p align="center">
  <img src="GreexAir/public/images/logo.png" alt="GrexAir Logo" width="220">
</p>

<h1 align="center">GrexAir IoT System</h1>

<p align="center">
  <b>Intelligens levegőminőség-felügyeleti és beavatkozó ökoszisztéma zárt területekhez.</b><br>
  <i>Automatizált CO₂ monitorozás, prediktív adatanalízis és környezeti szabályozás.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="NodeJS">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres">
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" alt="ESP32">
</p>

---

## 📖 Áttekintés

A **GrexAir** egy olyan IoT megoldás, amely zárt területek levegőminőségének (elsődlegesen CO₂ koncentrációjának) folyamatos felügyeletére és aktív szabályozására szolgál. A rendszer ötvözi a valós idejű adatgyűjtést a fejlett szoftveres analitikával, hogy kritikus értékek esetén automatizált fizikai beavatkozással biztosítsa a megfelelő légcserét.

## ✨ Kiemelt Funkciók

- 📊 **Valós idejű Dashboard:** Interaktív felület az aktuális és archív mérési adatok vizualizációjához.
- 🧠 **Prediktív Analitika:** Savitzky-Golay szűrőalkalmazás a zajmentes mérésekhez és a gázkoncentráció változási sebességének kiszámításához.
- 🔌 **Hardver Integráció:** Dedikált, alacsony késleltetésű API végpont az ESP32 alapú beavatkozó egységek kiszolgálásához.
- 🛡️ **Erőforrás-optimalizálás:** Többszintű gyorsítótárazás (caching) és adatritkítás (throttling) a hálózati terhelés minimalizálására.

## 🛠️ Technológiai Stack

| Réteg | Megvalósítás |
| :--- | :--- |
| **Backend** | Node.js (Express.js) & Socket.io |
| **Adatbázis** | PostgreSQL (Neon.tech Cloud) |
| **Algoritmusok** | Savitzky-Golay zajszűrés |
| **Infrastruktúra** | Docker & Docker Compose |

## ⚙️ Telepítés és Futtatás

1. **Repozitórium klónozása:**
   ```bash
   git clone [https://github.com/Eto6967/grexair-node.git](https://github.com/Eto6967/grexair-node.git)
Környezeti változók:
Hozd létre a .env fájlt a .env.example alapján, és add meg az adatbázis elérhetőségét (DB_URL).

Konténerek indítása:

Bash
docker-compose up -d --build


📂 Projektstruktúra


Szerveroldali logika: server.js

Adatkezelés és algoritmusok: dataManager.js

Adatgyűjtő modul: uploader.js

Frontend (EJS): views/ könyvtár

Statisztika és Stílus: public/ könyvtár

Konténerizáció: docker-compose.yml

<p align="center">
<b>GrexAir Project - Professzionális IoT Megoldás</b>


<i>Nyílt forráskódú rendszer a biztonságosabb beltéri környezetért.</i>
</p>
