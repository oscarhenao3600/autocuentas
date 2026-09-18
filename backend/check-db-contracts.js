const mongoose = require('mongoose');
require('dotenv').config();

const Contract = require('./models/Contract');

async function checkContracts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");
        
        const contracts = await Contract.find({});
        console.log(`Encontrados ${contracts.length} contratos en la base de datos.`);
        
        if (contracts.length > 0) {
            console.log("Primer contrato:");
            console.log(JSON.stringify(contracts[0].toObject(), null, 2));
        } else {
            console.log("No hay contratos en la base de datos.");
        }
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkContracts();
