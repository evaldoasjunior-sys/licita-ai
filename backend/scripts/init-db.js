import { databasePath, initializeDatabase } from "../src/database.js";

const database = initializeDatabase();
database.close();

console.log(`SQLite database initialized at ${databasePath}`);
