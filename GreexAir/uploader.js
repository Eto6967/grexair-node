const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { Client } = require('pg');

// --- KONFIGURÁCIÓ (A Te Neon Adatbázisod) ---
const NEON_DB_URL = process.env.DB_URL;

// Az Arduino portja
const SERIAL_PORT_NAME = '/dev/ttyUSB0'; 
const BAUD_RATE = 9600;

async function uploadData() {
    // Adatbázis kliens létrehozása
    const dbClient = new Client({
        connectionString: NEON_DB_URL,
    });

    try {
        // 1. Kapcsolódás a Neon felhőhöz
        console.log("Csatlakozas a Neon felhohoz...");
        await dbClient.connect();
        console.log("Neon adatbazis kapcsolat OK!");

        // 2. Kapcsolódás az Arduinohoz
        console.log(`Csatlakozas a porthoz: ${SERIAL_PORT_NAME}...`);
        const port = new SerialPort({ path: SERIAL_PORT_NAME, baudRate: BAUD_RATE });
        
        // Ez a parser soronként olvassa be az adatokat (mint a readline() a Pythonban)
        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        port.on('open', () => {
            console.log("Arduino kapcsolat OK!");
            console.log("-".repeat(30));
            console.log("Adatkuldes inditasa... (Ctrl+C a leallitashoz)");
        });

        port.on('error', (err) => {
            console.error(`HIBA: Nem sikerult megnyitni a portot (${SERIAL_PORT_NAME}):`, err.message);
        });

        // 3. Adatok olvasása és feltöltése
        parser.on('data', async (line) => {
            const cleanLine = line.trim();
            
            // Csak akkor megyünk tovább, ha az adat kizárólag számokból áll (isdigit)
            if (/^\d+$/.test(cleanLine)) {
                const co2Value = parseInt(cleanLine, 10);
                
                try {
                    // --- FELTÖLTÉS ---
                    const query = 'INSERT INTO sensor_data (co2_ppm) VALUES ($1)';
                    await dbClient.query(query, [co2Value]);
                    
                    console.log(`Mert adat: ${co2Value} ppm -> Feltoltve`);
                } catch (err) {
                    console.error(`Hiba kuldes kozben: ${err.message}`);
                }
            }
        });

        // 4. Biztonságos leállítás kezelése (Ctrl+C)
        process.on('SIGINT', async () => {
            console.log("\nLeallitas...");
            
            if (port.isOpen) {
                port.close();
            }
            await dbClient.end();
            
            console.log("Kapcsolatok bontva.");
            process.exit(0);
        });

    } catch (err) {
        console.error("Kritikus hiba tortent az inditaskor:", err);
    }
}

// Program indítása

uploadData();
