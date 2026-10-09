const mongoose = require('mongoose');

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
        console.log('--- INSPECCIÓN DE BASE DE DATOS ---');
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`Colección: ${col.name} -> ${count} documentos`);
        }

        console.log('\n--- USUARIOS ---');
        const users = await db.collection('users').find({}).toArray();
        for (const u of users) {
            console.log(`- User: ${u.fullName} (${u.email}) | Rol: ${u.role} | Cédula: ${u.cedula} | Telegram: ${u.telegramChatId} | Status: ${u.status}`);
        }

        console.log('\n--- CONTRATOS ---');
        const contracts = await db.collection('contracts').find({}).toArray();
        for (const c of contracts) {
            console.log(`- Contrato: ${c.contractNumber} | User ID: ${c.user} | Contratista: ${c.contractorName} | Cédula: ${c.idNumber} | Inicio: ${c.startDate} | Fin: ${c.endDate} | Obligaciones: ${c.activities?.length || 0}`);
        }

        console.log('\n--- PERIODOS DE FACTURACIÓN (ACTAS) ---');
        const periods = await db.collection('billingperiods').find({}).toArray();
        for (const p of periods) {
            console.log(`- Acta N°: ${p.actNumber} | User: ${p.user} | Contrato: ${p.contract} | Descartada: ${p.isDiscarded} | Status: ${p.status} | Periodo: ${p.periodFrom} a ${p.periodTo}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error inspeccionando BD:', err);
        process.exit(1);
    }
}

inspect();
