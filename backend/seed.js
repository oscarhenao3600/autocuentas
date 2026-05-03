const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB para la migración inicial');

        const adminExists = await User.findOne({ role: 'admin' });

        if (adminExists) {
            console.log('ℹ️ Ya existe al menos un administrador en el sistema.');
        } else {
            const admin = new User({
                fullName: 'Administrador Maestro',
                email: 'oscarhenao3600@gmail.com',
                password: 'Fg@uniquindio75510', // Recomiendo cambiarla después del primer login
                role: 'admin'
            });

            await admin.save();
            console.log('🚀 Administrador inicial creado con éxito!');
            console.log('📧 Email: oscarhenao3600@gmail.com');
            console.log('🔑 Password: Fg@uniquindio75510');
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error en la migración:', error.message);
        process.exit(1);
    }
};

seedAdmin();
