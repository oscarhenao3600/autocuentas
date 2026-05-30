const mongoose = require('mongoose');
const Contract = require('./models/Contract');
const Account = require('./models/Account');
require('dotenv').config();

const clearData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB para la limpieza de datos');

        // Delete all contracts
        const contractDeleteResult = await Contract.deleteMany({});
        console.log(`🗑️ Se eliminaron ${contractDeleteResult.deletedCount} contratos (minutas).`);

        // Delete all collection accounts
        const accountDeleteResult = await Account.deleteMany({});
        console.log(`🗑️ Se eliminaron ${accountDeleteResult.deletedCount} cuentas de cobro.`);

        console.log('🚀 Limpieza de datos completada con éxito! Se mantuvieron todos los usuarios.');
        
        mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error durante la limpieza de datos:', error.message);
        process.exit(1);
    }
};

clearData();
