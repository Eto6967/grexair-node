require('dotenv').config();

module.exports = {
    DB_URL: process.env.DB_URL,
    FILE_DEMO: 'SENSOR.CSV',
    MAX_POINTS: 2000,
    THRESHOLD_WARNING: 800,
    THRESHOLD_DANGER: 1200,
    CLASS_GOOD: "status-good",
    CLASS_WARNING: "status-warning",
    CLASS_DANGER: "status-danger"
};