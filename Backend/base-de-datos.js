const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Las pruebas usan otra base (variable BASE_DE_DATOS) para no tocar la real
const archivo = process.env.BASE_DE_DATOS || path.join(__dirname, 'dissonance.db');
const db = new Database(archivo);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
