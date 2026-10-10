const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
    let email = 'formatoscuentas09@gmail.com';
    let newPassword = null;

    if (process.argv.length === 3) {
        // Un solo parámetro proporcionado: se toma como la contraseña directamente
        newPassword = process.argv[2].trim();
    } else if (process.argv.length >= 4) {
        // Dos parámetros proporcionados: correo y contraseña
        email = process.argv[2].trim().toLowerCase();
        newPassword = process.argv[3].trim();
    }

    if (!newPassword) {
        console.error('❌ Error: Debes especificar una nueva contraseña.');
        console.log('Uso: node reset_admin_password.js <nueva_contraseña>');
        console.log('O bien: node reset_admin_password.js <correo> <nueva_contraseña>');
        process.exit(1);
    }

    if (newPassword.length < 8) {
        console.error('❌ Error: La contraseña debe tener al menos 8 caracteres.');
        process.exit(1);
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';
    console.log(`⏳ Conectando a la base de datos (${mongoUri.replace(/:([^:@]+)@/, ':****@')})...`);

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Conexión establecida a MongoDB.');

        const user = await User.findOne({ email });
        if (!user) {
            console.error(`❌ Usuario con correo "${email}" no encontrado en la base de datos.`);
            process.exit(1);
        }

        user.password = newPassword;
        // Ensure user is active and has admin role
        user.isActive = true;
        user.status = 'active';
        user.role = 'admin';

        await user.save(); // Dispatches pre('save') bcrypt hash

        console.log('\n======================================================');
        console.log('🎉 ¡CONTRASEÑA ACTUALIZADA CON ÉXITO!');
        console.log('======================================================');
        console.log(`👤 Usuario: ${user.fullName}`);
        console.log(`📧 Correo:  ${user.email}`);
        console.log(`🛡️ Rol:     ${user.role}`);
        console.log(`🔑 Estado:  ${user.status}`);
        console.log('======================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error al actualizar la contraseña:', err.message);
        process.exit(1);
    }
}

main();
