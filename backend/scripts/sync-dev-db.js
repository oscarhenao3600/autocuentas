const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mapFile = path.resolve(__dirname, '..', 'drive-prod-to-dev-map.json');
const idMap = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {};

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';

async function syncDevDb() {
    console.log('Connecting to dev MongoDB...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected!');

    const contractCol = mongoose.connection.db.collection('contracts');
    const periodCol = mongoose.connection.db.collection('billingperiods');
    const userCol = mongoose.connection.db.collection('users');

    // 1. Get client user (oscar henao)
    const user = await userCol.findOne({ email: 'oscarhenao3600@gmail.com' });
    if (!user) {
        console.error('User oscarhenao3600@gmail.com not found');
        process.exit(1);
    }
    console.log(`User found: ${user.fullName} (${user._id})`);

    // 2. Update contract in dev with official details and dev Drive IDs
    const contract = await contractCol.findOne({ user: user._id });
    if (contract) {
        const updates = {
            contractNumber: 'CO1.PCCNTR.9868346',
            contractorName: 'Oscar Alexander Henao Hernandez',
            // Updated file paths pointing to copied dev files
            baseDocumentPath: '/api/drive/file/1NhDbpp4bUqhoZQlJqzk6K2c2pumOVnVZ/minuta_1790522341064-360686729.pdf',
            actaInicioPath: '/api/drive/file/1wmWG7CIHK-mzwVbxjWcQY_4-eKGnE0x7/acta_inicio_1790522419228-637215427.pdf',
            rpPath: '/api/drive/file/1DiIfvdw02-DnH_lM_isfussj7wvVg6oy/rp_1790547169363-279533593.pdf',
            rutPath: '/api/drive/file/1L5pLarK9PQTmGwLnGzB3DJDMtXc10L6D/rut_1790547217370-978873119.pdf',
            bankCertificatePath: '/api/drive/file/1Z3zWlI27FIKKQva3NA9XFbPrmYwuWbVR/bank_cert_1790547248509-72775209.pdf',
            securitySocialPath: '/api/drive/file/139KqOExjy81hNwkcRYcNbyAXoFziitZm/seguridad_social_1790659624966-298207562.pdf'
        };

        await contractCol.updateOne({ _id: contract._id }, { $set: updates });
        console.log('✅ Contrato actualizado en dev con datos oficiales y archivos de dev.');
    }

    // 3. Update or populate BillingPeriod 1 (Acta 1) with all copied evidences from telegram_evidencias in dev
    let period = await periodCol.findOne({ user: user._id, actNumber: 1 });
    if (!period) {
        console.log('Creando BillingPeriod 1...');
        const newDoc = {
            user: user._id,
            contract: contract ? contract._id : null,
            actNumber: 1,
            periodFrom: new Date('2026-09-27T05:00:00.000Z'),
            periodTo: new Date('2026-10-27T04:59:59.000Z'),
            activities: [],
            status: 'pending',
            isPaid: true,
            paymentStatus: 'free_trial',
            createdAt: new Date()
        };
        const ins = await periodCol.insertOne(newDoc);
        period = await periodCol.findOne({ _id: ins.insertedId });
    }

    // Prepare evidences per obligation code:
    // Obligation 0 (2.2.1) -> 3 PDFs
    const ev0 = [
        { filename: 'evidence_0-1790658605269-461230000.pdf', path: '/api/drive/file/1jCMFbtfoXeVV5XEQtofKdwdCLcOIsUUz/evidence_0-1790658605269-461230000.pdf', driveId: '1jCMFbtfoXeVV5XEQtofKdwdCLcOIsUUz', mimetype: 'application/pdf' },
        { filename: 'evidence_0-1790658609934-369142047.pdf', path: '/api/drive/file/1vtjh_lmU_ddh2l_YaPiyR2OR5uhXlhiW/evidence_0-1790658609934-369142047.pdf', driveId: '1vtjh_lmU_ddh2l_YaPiyR2OR5uhXlhiW', mimetype: 'application/pdf' },
        { filename: 'evidence_0-1790658612845-320875494.pdf', path: '/api/drive/file/1y7hVn1FijeJfrFC2QB3iDcY8VxZx5Aus/evidence_0-1790658612845-320875494.pdf', driveId: '1y7hVn1FijeJfrFC2QB3iDcY8VxZx5Aus', mimetype: 'application/pdf' }
    ];

    // Obligation 1 (2.2.2) -> 4 JPGs + 1 Excel
    const ev1 = [
        { filename: 'evidence_1-1790658907882-326814237.jpg', path: '/api/drive/file/1kprSrLRIcVNucTPoqJA7Px0paTpYwD6q/evidence_1-1790658907882-326814237.jpg', driveId: '1kprSrLRIcVNucTPoqJA7Px0paTpYwD6q', mimetype: 'image/jpeg' },
        { filename: 'evidence_1-1790658911582-180126436.jpg', path: '/api/drive/file/1my_eC0b1VnER4N15akC4d76SqcCXWJSj/evidence_1-1790658911582-180126436.jpg', driveId: '1my_eC0b1VnER4N15akC4d76SqcCXWJSj', mimetype: 'image/jpeg' },
        { filename: 'evidence_1-1790658914509-97760045.jpg',  path: '/api/drive/file/1E3PCB9ZHGuGr4VCup1uWqDEPcVreJTyb/evidence_1-1790658914509-97760045.jpg', driveId: '1E3PCB9ZHGuGr4VCup1uWqDEPcVreJTyb', mimetype: 'image/jpeg' },
        { filename: 'evidence_1-1790658917681-194847844.jpg', path: '/api/drive/file/1reu9Qip6y3fuIs53xOR2lR5URc9zP-Ij/evidence_1-1790658917681-194847844.jpg', driveId: '1reu9Qip6y3fuIs53xOR2lR5URc9zP-Ij', mimetype: 'image/jpeg' },
        { filename: 'evidence_1-1790691246344-313589366.xlsx', path: '/api/drive/file/1ea5yJ6I1XrFSz_tXWAtsca4JJhUgYeZy/evidence_1-1790691246344-313589366.xlsx', driveId: '1ea5yJ6I1XrFSz_tXWAtsca4JJhUgYeZy', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    ];

    // Obligation 2 (2.2.3) -> 1 Excel
    const ev2 = [
        { filename: 'evidence_2-1790659097828-715870859.xlsx', path: '/api/drive/file/1jSK6tdwZ7ehY_DnsqvRScxQtv6cMWoxZ/evidence_2-1790659097828-715870859.xlsx', driveId: '1jSK6tdwZ7ehY_DnsqvRScxQtv6cMWoxZ', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    ];

    // Obligation 3 (2.2.4) -> 5 JPGs
    const ev3 = [
        { filename: 'evidence_3-1790659335705-224716406.jpg', path: '/api/drive/file/1kBDq8pi8SGeGPvP7676esZhwj2WKjQlw/evidence_3-1790659335705-224716406.jpg', driveId: '1kBDq8pi8SGeGPvP7676esZhwj2WKjQlw', mimetype: 'image/jpeg' },
        { filename: 'evidence_3-1790659339495-879144904.jpg', path: '/api/drive/file/1d1H6h-3XNuELypizqkNT9q2qd0JwWNz8/evidence_3-1790659339495-879144904.jpg', driveId: '1d1H6h-3XNuELypizqkNT9q2qd0JwWNz8', mimetype: 'image/jpeg' },
        { filename: 'evidence_3-1790659343323-46958703.jpg',  path: '/api/drive/file/1iEzDJPPuhriSDskuj2AawHFaz1DK_NFp/evidence_3-1790659343323-46958703.jpg', driveId: '1iEzDJPPuhriSDskuj2AawHFaz1DK_NFp', mimetype: 'image/jpeg' },
        { filename: 'evidence_3-1790659346987-474634692.jpg', path: '/api/drive/file/1tvof8tNcSXQco4ybHQmU_naAzAG6qCKb/evidence_3-1790659346987-474634692.jpg', driveId: '1tvof8tNcSXQco4ybHQmU_naAzAG6qCKb', mimetype: 'image/jpeg' },
        { filename: 'evidence_3-1790659350381-389381791.jpg', path: '/api/drive/file/1DOzPNP6eWP1d3OfJckDebrULLt8HTfx8/evidence_3-1790659350381-389381791.jpg', driveId: '1DOzPNP6eWP1d3OfJckDebrULLt8HTfx8', mimetype: 'image/jpeg' }
    ];

    // Obligation 4 (2.2.5) -> 7 JPGs
    const ev4 = [
        { filename: 'evidence_4-1790659532211-247792750.jpg', path: '/api/drive/file/18a9xyDFeFIfKedBYM6DKbuNYyhUdJkp4/evidence_4-1790659532211-247792750.jpg', driveId: '18a9xyDFeFIfKedBYM6DKbuNYyhUdJkp4', mimetype: 'image/jpeg' },
        { filename: 'evidence_4-1790659536151-660665004.jpg', path: '/api/drive/file/1gXP_IrNirxPF0D6UmRtwlA4RY4CoCJYv/evidence_4-1790659536151-660665004.jpg', driveId: '1gXP_IrNirxPF0D6UmRtwlA4RY4CoCJYv', mimetype: 'image/jpeg' },
        { filename: 'evidence_4-1790659539663-514430863.jpg', path: '/api/drive/file/1C3TYv-BA6nqKdAP5h6ksW7TIkYYsIhe4/evidence_4-1790659539663-514430863.jpg', driveId: '1C3TYv-BA6nqKdAP5h6ksW7TIkYYsIhe4', mimetype: 'image/jpeg' },
        { filename: 'evidence_4-1790659543205-444807283.jpg', path: '/api/drive/file/1qZUFY9GwlSIdcf7WQ0Ady3336mM98Pgy/evidence_4-1790659543205-444807283.jpg', driveId: '1qZUFY9GwlSIdcf7WQ0Ady3336mM98Pgy', mimetype: 'image/jpeg' },
        { filename: 'evidence_4-1790659546650-682659297.jpg', path: '/api/drive/file/14sZ1APChJNvtUJl1P-hlKAcE6zPOXCmA/evidence_4-1790659546650-682659297.jpg', driveId: '14sZ1APChJNvtUJl1P-hlKAcE6zPOXCmA', mimetype: 'image/jpeg' },
        { filename: 'evidence_4-1790659549982-450643521.jpg', path: '/api/drive/file/1v5bQdi7Qjunitppsez9cBsUksFLbcDDl/evidence_4-1790659549982-450643521.jpg', driveId: '1v5bQdi7Qjunitppsez9cBsUksFLbcDDl', mimetype: 'image/jpeg' },
        { filename: 'evidence_4-1790659553436-730148953.jpg', path: '/api/drive/file/1ohLvx4kvNLuYPD6wxpdcOBJ0o3X63deY/evidence_4-1790659553436-730148953.jpg', driveId: '1ohLvx4kvNLuYPD6wxpdcOBJ0o3X63deY', mimetype: 'image/jpeg' }
    ];

    const allEvs = [ev0, ev1, ev2, ev3, ev4];
    const updatedActivities = (period.activities || []).map((act, i) => {
        return {
            ...act,
            evidences: allEvs[i] || []
        };
    });

    await periodCol.updateOne(
        { _id: period._id },
        {
            $set: {
                activities: updatedActivities,
                securitySocialPath: '/api/drive/file/139KqOExjy81hNwkcRYcNbyAXoFziitZm/seguridad_social_1790659624966-298207562.pdf',
                status: 'pending',
                zipDownloaded: false,
                isPaid: true,
                paymentStatus: 'free_trial'
            }
        }
    );

    console.log('✅ BillingPeriod 1 (Acta 1) sincronizado con todas las 21 evidencias copiadas y Planilla SS.');
    console.log('🎉 Todo listo en dev para generar y probar sin afectar producción.');
    process.exit(0);
}

syncDevDb().catch(err => {
    console.error('Error sincronizando BD dev:', err);
    process.exit(1);
});
