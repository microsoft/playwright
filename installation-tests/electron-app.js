const { app } = require('electron');

app.on('window-all-closed', e => e.preventDefault());