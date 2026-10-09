const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Contract = require('../models/Contract');

async function inspectUser() {
    await mongoose.connect(process.env.MONGODB_URI);
    const u = await User.findOne({ telegramChatId: '814479301' });
    console.log('User 814479301:', u ? {
        id: u._id,
        fullName: u.fullName,
        cedula: u.cedula,
        email: u.email,
        acceptedTerms: u.acceptedTerms,
        acceptedTermsAt: u.acceptedTermsAt,
        telegramChatId: u.telegramChatId
    } : 'NOT FOUND');

    const contracts = u ? await Contract.find({ user: u._id }) : [];
    console.log('Contracts count:', contracts.length);
    for (const c of contracts) {
        console.log('- Contrato:', c.contractNumber, 'idNumber:', c.idNumber, 'supervisor:', c.supervisorName);
    }
    process.exit(0);
}

inspectUser().catch(console.error);
