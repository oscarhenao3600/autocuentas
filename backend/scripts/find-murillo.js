require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function search() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas');
    const cols = await mongoose.connection.db.listCollections().toArray();
    for (const c of cols) {
        const docs = await mongoose.connection.db.collection(c.name).find().toArray();
        for (const doc of docs) {
            const str = JSON.stringify(doc);
            if (str.includes('Murillo') || str.includes('9771981') || str.includes('Mantenimientos')) {
                console.log(`\n=== Found in collection: ${c.name} (ID: ${doc._id}) ===`);
                console.log(JSON.stringify(doc, null, 2));
            }
        }
    }
    await mongoose.disconnect();
}

search().catch(console.error);
