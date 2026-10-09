/**
 * SCRIPT DE REPARACIÓN Y SANEAMIENTO DE BASE DE DATOS
 * - Separa usuarios y contratos que quedaron cruzados.
 * - Sincroniza el campo 'cedula' y 'acceptedTerms' en los usuarios.
 * - Sanea los BillingPeriods (actas): inicializa isDiscarded, sincroniza fechas y contratos.
 * - Permite omitir/descartar la Cuenta 1 de forma persistente y limpia.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const { calculatePeriods, determineActiveAct } = require('../utils/period.utils');

async function repairDatabase() {
    console.log('=====================================================');
    console.log('🔄 INICIANDO SANEAMIENTO Y REPARACIÓN DE BASE DE DATOS');
    console.log('=====================================================\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
        console.log('✅ Conexión establecida con MongoDB');

        // ------------------------------------------------------------------
        // PASO 1: SEPARAR Y ASIGNAR USUARIOS DEDICADOS POR CADA CONTRATISTA
        // ------------------------------------------------------------------
        console.log('\n[Paso 1] Verificando correspondencia Usuario <-> Contrato...');
        const allContracts = await Contract.find({});

        for (const contract of allContracts) {
            const cleanId = (contract.idNumber || '').replace(/\D/g, '');
            if (!cleanId) continue;

            // Buscar si ya existe un usuario con esta cédula
            let user = await User.findOne({
                $or: [
                    { cedula: cleanId },
                    { email: contract.contractorEmail }
                ]
            });

            if (!user) {
                // Si el usuario actual del contrato tiene un email/nombre diferente, crear usuario dedicado
                const currentUser = await User.findById(contract.user);
                const isDifferentPerson = currentUser && (
                    (currentUser.fullName && !currentUser.fullName.toLowerCase().includes((contract.contractorName || '').toLowerCase().split(' ')[0])) ||
                    (currentUser.email && contract.contractorEmail && currentUser.email !== contract.contractorEmail)
                );

                if (isDifferentPerson || !currentUser) {
                    console.log(`⚡ Creando usuario independiente para contratista: ${contract.contractorName} (Cédula: ${cleanId})`);
                    const defaultPassword = `Contratista.${cleanId}*`;
                    user = await User.create({
                        fullName: contract.contractorName || 'Contratista',
                        email: contract.contractorEmail || `contratista_${cleanId}@autocuentas.com`,
                        cedula: cleanId,
                        password: defaultPassword,
                        role: 'client',
                        status: 'active',
                        isActive: true,
                        acceptedTerms: true,
                        acceptedTermsAt: new Date()
                    });
                    console.log(`✅ Usuario creado: ${user.fullName} (${user.email}) con clave provisional: ${defaultPassword}`);
                } else {
                    user = currentUser;
                    user.cedula = cleanId;
                    user.acceptedTerms = true;
                    if (!user.acceptedTermsAt) user.acceptedTermsAt = new Date();
                    await user.save();
                }
            } else {
                user.cedula = cleanId;
                if (!user.acceptedTerms) {
                    user.acceptedTerms = true;
                    user.acceptedTermsAt = new Date();
                }
                await user.save();
            }

            // Asegurar que el contrato apunte al usuario correcto
            if (contract.user?.toString() !== user._id.toString()) {
                console.log(`🔗 Reasignando contrato ${contract.contractNumber} al usuario correcto: ${user.fullName} (${user._id})`);
                contract.user = user._id;
                await contract.save();
            }
        }

        // Actualizar todos los usuarios existentes con su cédula si no la tenían
        const users = await User.find({ role: 'client' });
        for (const u of users) {
            if (!u.cedula) {
                const c = await Contract.findOne({ user: u._id });
                if (c && c.idNumber) {
                    u.cedula = c.idNumber.replace(/\D/g, '');
                    await u.save();
                    console.log(`🪪 Asignada cédula ${u.cedula} al usuario ${u.fullName}`);
                }
            }
        }

        // ------------------------------------------------------------------
        // PASO 2: SANEAMIENTO Y REGULARIZACIÓN DE PERIODOS DE FACTURACIÓN (ACTAS)
        // ------------------------------------------------------------------
        console.log('\n[Paso 2] Saneando periodos de facturación (BillingPeriods)...');
        const billingPeriods = await BillingPeriod.find({}).populate('contract');

        for (const bp of billingPeriods) {
            let modified = false;

            // 1. Asegurar que bp.user coincida con el usuario del contrato
            if (bp.contract && bp.contract.user && bp.user?.toString() !== bp.contract.user.toString()) {
                console.log(`🔗 Corrigiendo user en Acta N° ${bp.actNumber} del contrato ${bp.contract.contractNumber}`);
                bp.user = bp.contract.user;
                modified = true;
            }

            // 2. Normalizar flags isDiscarded y status
            if (bp.status === 'discarded') {
                if (!bp.isDiscarded) {
                    bp.isDiscarded = true;
                    modified = true;
                }
                if (!bp.discardedAt) {
                    bp.discardedAt = new Date();
                    modified = true;
                }
            } else {
                if (bp.isDiscarded === undefined || bp.isDiscarded === null) {
                    bp.isDiscarded = false;
                    modified = true;
                }
            }

            // 3. Verificar y corregir fechas si están desfasadas respecto al contrato
            if (bp.contract && bp.contract.startDate) {
                const timeline = calculatePeriods(
                    bp.contract.startDate,
                    bp.contract.initialDurationMonths || 4,
                    bp.contract.additionDurationMonths || 0,
                    bp.contract.periodType || 'mes_cumplido',
                    bp.contract.endDate,
                    bp.contract.customDeliveryDate
                );

                const periodInfo = timeline.find(p => p.actNumber === bp.actNumber);
                if (periodInfo) {
                    const expectedFrom = new Date(periodInfo.from + 'T00:00:00.000Z');
                    const expectedTo = new Date(periodInfo.to + 'T23:59:59.999Z');

                    // Si hay una diferencia de más de 60 días con la fecha esperada, corregirla
                    const diffDays = Math.abs((bp.periodFrom.getTime() - expectedFrom.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays > 60) {
                        console.log(`📅 Corrigiendo fechas desfasadas en Acta N° ${bp.actNumber} (Contrato ${bp.contract.contractNumber}):`);
                        console.log(`   Anterior: ${bp.periodFrom.toISOString().split('T')[0]} a ${bp.periodTo.toISOString().split('T')[0]}`);
                        console.log(`   Nueva:    ${periodInfo.from} a ${periodInfo.to}`);
                        bp.periodFrom = expectedFrom;
                        bp.periodTo = expectedTo;
                        modified = true;
                    }
                }
            }

            if (modified) {
                await bp.save();
            }
        }

        // ------------------------------------------------------------------
        // PASO 3: APLICAR DESCARTE/OMISIÓN PERSISTENTE DE CUENTA 1
        // ------------------------------------------------------------------
        console.log('\n[Paso 3] Configurando omisión de Cuenta 1 para contratos activos...');
        const contractsToOmit = await Contract.find({ status: 'active' });
        for (const c of contractsToOmit) {
            // Verificar si ya existe Acta 1
            let period1 = await BillingPeriod.findOne({ contract: c._id, actNumber: 1 });
            if (period1) {
                if (!period1.isDiscarded || period1.status !== 'discarded') {
                    period1.isDiscarded = true;
                    period1.status = 'discarded';
                    period1.discardedAt = new Date();
                    await period1.save();
                    console.log(`⏭️ Cuenta 1 marcada como descartada/omitida para contrato ${c.contractNumber} (${c.contractorName})`);
                } else {
                    console.log(`ℹ️ Cuenta 1 ya se encuentra correctamente descartada para ${c.contractNumber}`);
                }
            } else {
                // Crear Acta 1 directamente como descartada
                const timeline = calculatePeriods(
                    c.startDate,
                    c.initialDurationMonths || 4,
                    c.additionDurationMonths || 0,
                    c.periodType || 'mes_cumplido',
                    c.endDate,
                    c.customDeliveryDate
                );
                const p1Info = timeline.find(p => p.actNumber === 1) || {
                    from: c.startDate || '2026-01-01',
                    to: c.endDate || '2026-01-31'
                };

                const activities = (c.activities || []).map((act, idx) => ({
                    obligationCode: `2.2.${idx + 1}`,
                    obligationText: typeof act === 'string' ? act : (act.description || `Obligación contractual ${idx + 1}`),
                    comment: '',
                    evidences: []
                }));

                period1 = await BillingPeriod.create({
                    user: c.user,
                    contract: c._id,
                    actNumber: 1,
                    periodFrom: new Date(p1Info.from + 'T00:00:00.000Z'),
                    periodTo: new Date(p1Info.to + 'T23:59:59.999Z'),
                    activities: activities,
                    isDiscarded: true,
                    status: 'discarded',
                    discardedAt: new Date()
                });
                console.log(`✨ Creada y descartada Cuenta 1 para contrato ${c.contractNumber} (${c.contractorName})`);
            }
        }

        // ------------------------------------------------------------------
        // PASO 4: VERIFICACIÓN FINAL Y ESTADO DE ACTAS
        // ------------------------------------------------------------------
        console.log('\n[Paso 4] Verificando resolución de actas activas tras el saneamiento...');
        const updatedContracts = await Contract.find({ status: 'active' }).populate('user');
        for (const c of updatedContracts) {
            const allPeriods = await BillingPeriod.find({ contract: c._id }).sort({ actNumber: 1 });
            const activeResult = determineActiveAct(c, allPeriods, new Date());
            console.log(`\n📌 Contratista: ${c.contractorName} (Cédula: ${c.idNumber})`);
            console.log(`   Usuario vinculado: ${c.user?.fullName} (${c.user?.email})`);
            console.log(`   Total Actas en BD: ${allPeriods.length}`);
            console.log(`   Acta 1 descartada: ${allPeriods.find(p => p.actNumber === 1)?.isDiscarded ? 'SÍ ✅' : 'NO ❌'}`);
            console.log(`   Acta Objetivo para Gestionar: Cuenta ${activeResult.targetAct}`);
            console.log(`   ¿Tiene transición pendiente (aviso de periodo previo)?: ${activeResult.hasTransitionPending ? `SÍ (Cuenta ${activeResult.unfinishedPreviousAct})` : 'NO'}`);
            console.log(`   Motivo: ${activeResult.reason}`);
        }

        console.log('\n=====================================================');
        console.log('🎉 SANEAMIENTO Y ACTUALIZACIÓN COMPLETADOS CON ÉXITO');
        console.log('=====================================================');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DEL SCRIPT:', err);
        process.exit(1);
    }
}

repairDatabase();
