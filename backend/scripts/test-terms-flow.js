const mongoose = require('mongoose');
const telegramService = require('../services/telegram.service');
const User = require('../models/User');
const Contract = require('../models/Contract');

async function runTests() {
    console.log('--- INICIANDO PRUEBAS DEL FLUJO DE REGISTRO Y TÉRMINOS Y CONDICIONES ---');
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
        console.log('✅ Conectado a MongoDB');

        const testChatId = 'test_chat_' + Date.now();
        const testCedula = '999888777';

        // 1. Limpiar cualquier registro previo de prueba
        await User.deleteMany({ email: /testterms.*@test\.com/ });
        await Contract.deleteMany({ idNumber: testCedula });

        // 2. Simular comando /start
        console.log('\n[1] Probando comando /start...');
        await telegramService.handleIncomingMessage({
            chat: { id: testChatId },
            text: '/start'
        });

        let session = telegramService.sessions.get(testChatId);
        console.log('Estado de sesión tras /start:', session ? session.state : 'null');
        if (session && session.state === 'awaiting_identification') {
            console.log('✅ /start solicita exitosamente número de documento (estado: awaiting_identification)');
        } else {
            throw new Error(`Esperado awaiting_identification pero se obtuvo ${session?.state}`);
        }

        // 3. Simular ingreso de cédula no registrada
        console.log('\n[2] Probando ingreso de cédula no registrada...');
        await telegramService.handleIncomingMessage({
            chat: { id: testChatId },
            text: testCedula
        });

        session = telegramService.sessions.get(testChatId);
        console.log('Estado de sesión tras cédula:', session ? session.state : 'null');
        if (session && session.state === 'awaiting_registration_consent' && session.tempCedula === testCedula) {
            console.log('✅ Cédula no registrada detectada correctamente, solicita confirmación de registro');
        } else {
            throw new Error(`Esperado awaiting_registration_consent pero se obtuvo ${session?.state}`);
        }

        // 4. Simular pulsación de botón 'start_registration' (o aceptación)
        console.log('\n[3] Probando clic en "📝 Sí, deseo registrarme" (start_registration)...');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_1',
            from: { id: testChatId },
            message: { chat: { id: testChatId }, message_id: 101 },
            data: 'start_registration'
        });

        session = telegramService.sessions.get(testChatId);
        console.log('Estado de sesión tras start_registration:', session ? session.state : 'null');
        if (session && session.state === 'awaiting_terms_acceptance' && session.tempCedula === testCedula) {
            console.log('✅ Despliega Términos y Condiciones y queda en estado awaiting_terms_acceptance');
        } else {
            throw new Error(`Esperado awaiting_terms_acceptance pero se obtuvo ${session?.state}`);
        }

        // 5. Simular aceptación explícita de Términos y Condiciones
        console.log('\n[4] Probando clic en "✅ Acepto los Términos y Continuar" (accept_terms_and_continue)...');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_2',
            from: { id: testChatId },
            message: { chat: { id: testChatId }, message_id: 102 },
            data: 'accept_terms_and_continue'
        });

        session = telegramService.sessions.get(testChatId);
        console.log('Estado de sesión tras aceptar términos:', session ? session.state : 'null');
        if (
            session &&
            session.state === 'reg_step_name' &&
            session.regData &&
            session.regData.acceptedTerms === true &&
            session.regData.acceptedTermsAt instanceof Date
        ) {
            console.log('✅ Términos aceptados, consentimiento registrado con fecha y hora, pasó a reg_step_name');
        } else {
            throw new Error(`Esperado reg_step_name con acceptedTerms=true pero se obtuvo: ${JSON.stringify(session)}`);
        }

        // 6. Probar pasos de registro para verificar persistencia en User
        console.log('\n[5] Completando cuestionario de registro...');
        // Paso 1: Nombre
        await telegramService.handleIncomingMessage({
            chat: { id: testChatId },
            text: 'Juan Pérez Contratista'
        });

        // Paso 2: Confirmar cédula
        await telegramService.handleCallbackQuery({
            id: 'cb_test_3',
            from: { id: testChatId },
            message: { chat: { id: testChatId }, message_id: 103 },
            data: 'confirm_cedula'
        });

        // Paso 3: Entidad
        await telegramService.handleIncomingMessage({
            chat: { id: testChatId },
            text: 'Secretaría de TIC y Competitividad'
        });

        // Paso 4: Teléfono
        await telegramService.handleIncomingMessage({
            chat: { id: testChatId },
            text: '3109876543'
        });

        // Paso 5: Correo electrónico
        const testEmail = `testterms_${Date.now()}@test.com`;
        await telegramService.handleIncomingMessage({
            chat: { id: testChatId },
            text: testEmail
        });

        // Verificar que el usuario fue creado en la base de datos con acceptedTerms: true
        const createdUser = await User.findOne({ email: testEmail });
        if (!createdUser) {
            throw new Error('El usuario no fue creado en la base de datos.');
        }

        console.log('Usuario creado en BD:', {
            fullName: createdUser.fullName,
            email: createdUser.email,
            cedula: createdUser.cedula,
            acceptedTerms: createdUser.acceptedTerms,
            acceptedTermsAt: createdUser.acceptedTermsAt
        });

        if (createdUser.acceptedTerms === true && createdUser.acceptedTermsAt && createdUser.cedula === testCedula) {
            console.log('✅ Usuario registrado exitosamente con cedula y acceptedTerms = true y timestamp auditado!');
        } else {
            throw new Error('El usuario no guardó cedula o acceptedTerms: true correctamente');
        }

        // 7. Probar búsqueda cuando el usuario ya está registrado
        console.log('\n[6] Probando búsqueda posterior de usuario registrado con su cédula...');
        const secondChatId = 'test_chat_existing_' + Date.now();
        await telegramService.handleIncomingMessage({
            chat: { id: secondChatId },
            text: '/start'
        });
        await telegramService.handleIncomingMessage({
            chat: { id: secondChatId },
            text: testCedula
        });

        let sessionExisting = telegramService.sessions.get(secondChatId);
        console.log('Estado de sesión usuario registrado (sin actividades):', sessionExisting ? sessionExisting.state : 'null');
        if (sessionExisting && (sessionExisting.state === 'awaiting_docs_consent' || sessionExisting.state === 'identified')) {
            console.log('✅ Usuario registrado reconocido exitosamente por su cédula!');
        } else {
            throw new Error(`Esperado state awaiting_docs_consent o identified pero se obtuvo ${sessionExisting?.state}`);
        }

        // Ahora agregar obligaciones al contrato y probar de nuevo para verificar estado 'identified'
        const existingContract = await Contract.findOne({ idNumber: testCedula });
        existingContract.activities = ['Obligación contractual número 1 de prueba'];
        await existingContract.save();

        const thirdChatId = 'test_chat_active_' + Date.now();
        await telegramService.handleIncomingMessage({
            chat: { id: thirdChatId },
            text: '/start'
        });
        await telegramService.handleIncomingMessage({
            chat: { id: thirdChatId },
            text: testCedula
        });

        let sessionActive = telegramService.sessions.get(thirdChatId);
        console.log('Estado de sesión usuario con contrato activo y obligaciones:', sessionActive ? sessionActive.state : 'null');
        if (sessionActive && sessionActive.state === 'identified') {
            console.log('✅ Usuario con contrato activo reconocido y menú habilitado!');
        } else {
            throw new Error(`Esperado state identified pero se obtuvo ${sessionActive?.state}`);
        }

        // Limpieza final
        await User.deleteMany({ email: testEmail });
        await Contract.deleteMany({ contractorEmail: testEmail });
        console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ ERROR EN LA PRUEBA:', err);
        process.exit(1);
    }
}

runTests();
