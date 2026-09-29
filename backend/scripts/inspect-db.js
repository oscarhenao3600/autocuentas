const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';
console.log('Connecting to:', uri);

mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 })
.then(async () => {
    console.log('Connected to Mongo successfully!');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    for (const c of collections) {
        const count = await mongoose.connection.db.collection(c.name).countDocuments();
        console.log(`- ${c.name}: ${count} docs`);
    }
    
    // Check contracts
    const contracts = await mongoose.connection.db.collection('contracts').find().toArray();
    console.log('\nContracts:');
    for (const ct of contracts) {
        console.log(`- Contract ${ct.contractNumber || ct._id}: contractor=${ct.contractorName}, id=${ct.idNumber}`);
    }

    // Check billing periods
    const billingPeriods = await mongoose.connection.db.collection('billingperiods').find().toArray();
    console.log('\nBilling Periods:');
    for (const bp of billingPeriods) {
        console.log(`- BP ${bp._id}: actNumber=${bp.actNumber}, status=${bp.status}, generatedZip=${bp.generatedZip}`);
    }

    process.exit(0);
})
.catch(err => {
    console.error('Mongo connection failed:', err.message);
    process.exit(1);
});
