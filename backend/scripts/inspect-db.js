const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const BillingPeriod = require('../models/BillingPeriod');
const Contract = require('../models/Contract');
const User = require('../models/User');

async function check() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';
    await mongoose.connect(uri);
    const periods = await BillingPeriod.find().sort({ createdAt: -1 }).limit(3);
    for (const p of periods) {
        console.log('=== BillingPeriod ===');
        console.log('ID:', p._id, 'Act:', p.actNumber, 'Status:', p.status);
        console.log('Period:', p.periodStart, 'to', p.periodEnd);
        console.log('SecuritySocial:', JSON.stringify(p.securitySocial, null, 2));
        console.log('Payment:', p.paymentAmount, 'Pending:', p.pendingBalance);
    }
    const contracts = await Contract.find().limit(3);
    for (const c of contracts) {
        console.log('=== Contract ===');
        console.log('ContractNumber:', c.contractNumber, 'Start:', c.startDate, 'End:', c.endDate);
        console.log('ExecutionTerm:', c.executionTerm, 'PeriodType:', c.periodType);
        console.log('TotalValue:', c.totalValue, 'PaymentAmount:', c.paymentAmount);
        console.log('RP:', c.rp, 'CDP:', c.cdp, 'Rubro:', c.rubro);
    }
    await mongoose.disconnect();
}
check().catch(console.error);
