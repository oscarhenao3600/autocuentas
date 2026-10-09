const mongoose = require('mongoose');

async function inspectContracts() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
    const db = mongoose.connection.db;
    const contracts = await db.collection('contracts').find({}).toArray();
    console.log('--- DETALLE CONTRATOS ---');
    contracts.forEach(c => {
        console.log({
            _id: c._id.toString(),
            contractNumber: c.contractNumber,
            user: c.user?.toString(),
            contractorName: c.contractorName,
            idNumber: c.idNumber,
            startDate: c.startDate,
            endDate: c.endDate
        });
    });

    const billingPeriods = await db.collection('billingperiods').find({}).toArray();
    console.log('\n--- DETALLE BILLING PERIODS ---');
    billingPeriods.forEach(b => {
        console.log({
            _id: b._id.toString(),
            actNumber: b.actNumber,
            user: b.user?.toString(),
            contract: b.contract?.toString(),
            status: b.status,
            isDiscarded: b.isDiscarded,
            periodFrom: b.periodFrom,
            periodTo: b.periodTo
        });
    });
    process.exit(0);
}

inspectContracts();
