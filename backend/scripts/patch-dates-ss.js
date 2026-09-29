const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';

async function run() {
    await mongoose.connect(MONGODB_URI);
    const Contract = mongoose.model('Contract', new mongoose.Schema({}, { strict: false }));
    const BillingPeriod = mongoose.model('BillingPeriod', new mongoose.Schema({}, { strict: false }));

    const cRes = await Contract.updateMany({ $or: [{ endDate: { $exists: false } }, { endDate: '' }, { endDate: null }] }, {
        $set: { endDate: '2026-12-20' }
    });
    console.log('Contract updated:', cRes);

    const bpRes = await BillingPeriod.updateMany({
        $or: [
            { 'securitySocial.totalPaid': 0 },
            { 'securitySocial.totalPaid': { $exists: false } },
            { 'securitySocial.planillaNumber': '' },
            { 'securitySocial.planillaNumber': { $exists: false } }
        ]
    }, {
        $set: {
            'securitySocial.operator': 'SIMPLE',
            'securitySocial.planillaNumber': '1085439710',
            'securitySocial.totalPaid': 51600,
            'securitySocial.saludPaid': 21900,
            'securitySocial.pensionPaid': 28100,
            'securitySocial.arlPaid': 1000,
            'securitySocial.period': 'Agosto de 2026'
        }
    });
    console.log('BillingPeriod updated:', bpRes);

    await mongoose.disconnect();
    console.log('Done');
}

run().catch(console.error);
