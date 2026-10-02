const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Contract = require('../models/Contract');
const User = require('../models/User');
const BillingPeriod = require('../models/BillingPeriod');
const { calculatePeriods, determineActiveAct } = require('../utils/period.utils');

async function testContractDelivery() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27019/formatos_cuentas';
        await mongoose.connect(mongoUri);
        console.log('Conectado a MongoDB...');

        const user = await User.findOne({ telegramChatId: '814479301' });
        if (!user) {
            console.log('Usuario de prueba no encontrado');
            return;
        }

        const contract = await Contract.findOne({ user: user._id });
        if (!contract) {
            console.log('Contrato de prueba no encontrado');
            return;
        }

        console.log(`Contratista: ${user.fullName} (${contract.contractNumber})`);
        console.log(`Fecha inicio: ${contract.startDate}, Fecha fin: ${contract.endDate}`);
        console.log(`Fecha de entrega actual: ${contract.customDeliveryDate || '(Ninguna)'}`);

        // Asignar fecha de entrega especial de diciembre
        contract.customDeliveryDate = '2026-12-16';
        contract.deliveryNotes = 'Cierre fiscal de Tesorería Municipal vigencia 2026';
        await contract.save();
        console.log(`\n✅ Fecha de entrega actualizada a ${contract.customDeliveryDate}`);

        // Calcular periodos
        const periods = calculatePeriods(
            contract.startDate,
            contract.initialDurationMonths || 4,
            contract.additionDurationMonths || 0,
            contract.periodType || 'mes_cumplido',
            contract.endDate,
            contract.customDeliveryDate
        );

        console.log('\nPeriodos calculados para el contrato:');
        periods.forEach(p => {
            console.log(` - Acta ${p.actNumber}: ${p.from} al ${p.to} ${p.isCustomCutoff ? '📅 [Cierre Especial Diciembre]' : ''}`);
        });

        const activeInfo = determineActiveAct(contract, [], new Date());
        console.log(`\nActa activa: ${activeInfo.targetAct}`);
        console.log(`Motivo: ${activeInfo.reason}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testContractDelivery();
