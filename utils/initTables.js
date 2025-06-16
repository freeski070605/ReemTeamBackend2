// utils/initTables.js
const Table = require('../models/Table');

async function initializeTables() {
  const existingCount = await Table.countDocuments();

  if (existingCount > 0) {
    console.log('Tables already initialized.');
    return;
  }

  const tables = [
    { tableId: 'table-1', amount: 1, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-2', amount: 1, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-3', amount: 5, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-4', amount: 5, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-5', amount: 10, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-6', amount: 10, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-7', amount: 20, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-8', amount: 20, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-9', amount: 50, maxPlayers: 4, currentPlayers: 0 },
    { tableId: 'table-10', amount: 50, maxPlayers: 4, currentPlayers: 0 },
  ];

  await Table.insertMany(tables);
  console.log('Reem Team tables initialized successfully.');
}

module.exports = initializeTables;
