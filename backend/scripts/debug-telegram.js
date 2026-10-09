const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ telegramChatId: { $ne: null } }).sort({ updatedAt: -1 }).limit(5);
    console.log('Usuarios con telegramChatId:');
    users.forEach(u => console.log(`- ${u.fullName} (CC: ${u.cedula}, ChatID: ${u.telegramChatId}, Updated: ${u.updatedAt})`));
    process.exit(0);
}
run();
