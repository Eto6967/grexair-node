
<p align="center">
  <img src="GreexAir/public/images/logo.png" alt="GrexAir Logo" width="220">
</p>

<h1 align="center">GrexAir IoT System</h1>

<p align="center">
  <b>Intelligens levegőminőség-felügyeleti és beavatkozó ökoszisztéma zárt területekhez.</b><br>
  <i>Automatizált CO₂ monitorozás, prediktív adatanalízis és környezeti szabályozás.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="NodeJS">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres">
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="ChartJS">
</p>

---

## 📖 Áttekintés

A **GrexAir** egy olyan IoT megoldás, amely zárt területek levegőminőségének (elsődlegesen CO₂ koncentrációjának) folyamatos felügyeletére és aktív szabályozására szolgál. A rendszer ötvözi a valós idejű adatgyűjtést a fejlett szoftveres analitikával, hogy kritikus értékek esetén automatizált fizikai beavatkozással biztosítsa a megfelelő légcserét.

## ✨ Kiemelt Funkciók

- 📈 **Dinamikus Vizualizáció:** Chart.js alapú, valós idejű grafikonok dinamikus Y-tengely skálázással és interaktív időtáv-szűréssel (15p, 30p, 1ó, Összes).
- 🧠 **Prediktív Analitika:** Savitzky-Golay szűrőalkalmazás a zajmentes mérésekhez, valamint a gázkoncentráció változási sebességének és gyorsulásának kiszámításához.
- 🟢 **Okos Státuszfigyelés:** Időzóna-független, intelligens Online/Offline detektálás, amely azonnal jelzi a szenzor adatfolyamának megszakadását.
- 🔌 **Hardver Integráció:** Közvetlen USB soros port (Serial) kommunikáció az adatgyűjtő hardverekkel (Arduino/ESP), dedikált uploader szolgáltatáson keresztül.
- 🛡️ **Erőforrás-optimalizálás:** Többszintű gyorsítótárazás (caching), Socket.io alapú eseményvezérelt frissítés és visszamenőleges archívum (naptár funkció).

## 🛠️ Technológiai Stack

| Réteg | Megvalósítás |
| :--- | :--- |
| **Backend** | Node.js (Express.js) & Socket.io |
| **Frontend** | EJS, Vanilla JS, Chart.js, egyedi CSS |
| **Adatbázis** | PostgreSQL (Neon.tech Cloud) |
| **Algoritmusok** | Savitzky-Golay zajszűrés (`ml-savitzky-golay`) |
| **Infrastruktúra** | Docker & Docker Compose (Kettős konténer: App + Uploader) |

## ⚙️ Telepítés és Futtatás

**1. Repozitórium klónozása:**
```bash
git clone [https://github.com/Eto6967/grexair-node.git](https://github.com/Eto6967/grexair-node.git)
cd grexair-node
2. Környezeti változók (.env):
Hozd létre a .env fájlt a főkönyvtárban, és add meg az adatbázis elérhetőségét:

Kódrészlet
DB_URL=postgresql://felhasznalo:jelszo@ep-valami.neon.tech/neve?sslmode=require
3. Konténerek indítása (Docker):
A rendszer két konténert indít: egyet a weboldalnak (greexair-app) és egyet a soros portos adatgyűjtésnek (greexair-uploader).

Bash
docker-compose up -d --build
📂 Projektstruktúra
server.js - Fő webszerver, API végpontok és WebSockets logika.

uploader.js - Dedikált adatgyűjtő, amely a soros portról (/dev/ttyUSB0) olvassa és továbbítja a mérési adatokat.

dataManager.js - Adatbázis-kapcsolat, gyorsítótárazás és Savitzky-Golay matematikai analízis.

public/js/monitor.js - A frontend agya: grafikonok rajzolása, dinamikus skálázás és státuszfigyelés.

views/ - EJS HTML sablonok (monitor, live, index).

docker-compose.yml - A kettős (App + Uploader) szolgáltatás-architektúra definíciója.

<p align="center">
<b>GrexAir Project • Professzionális IoT Megoldás</b>


<i>Nyílt forráskódú rendszer a biztonságosabb beltéri környezetért.</i>
</p>
