const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const googleDriveService = require('../services/googleDrive.service');

async function inspect() {
    await googleDriveService.init();
    const drive = googleDriveService.getDrive();
    const rootId = await googleDriveService.getRootFolderId();
    console.log(`Root folder ID (${googleDriveService.rootFolderName}): ${rootId}`);

    const rootChildren = await drive.files.list({
        q: `'${rootId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive'
    });

    console.log('\nDirect children of AutoCuentas:');
    for (const file of rootChildren.data.files) {
        console.log(`- [${file.mimeType === 'application/vnd.google-apps.folder' ? 'DIR' : 'FILE'}] ${file.name} (id: ${file.id})`);
    }

    // Let's inspect 'prod' and 'dev' folders specifically
    for (const envName of ['prod', 'dev']) {
        const envFolder = rootChildren.data.files.find(f => f.name.toLowerCase() === envName && f.mimeType === 'application/vnd.google-apps.folder');
        if (envFolder) {
            console.log(`\n--- Contents of ${envName} (${envFolder.id}) ---`);
            await listRecursive(drive, envFolder.id, '  ');
        } else {
            console.log(`\n--- Folder ${envName} NOT FOUND under root ---`);
        }
    }
}

async function listRecursive(drive, folderId, indent) {
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size)',
        spaces: 'drive',
        pageSize: 100
    });

    for (const f of res.data.files) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
            console.log(`${indent}📁 ${f.name} (id: ${f.id})`);
            await listRecursive(drive, f.id, indent + '  ');
        } else {
            console.log(`${indent}📄 ${f.name} (id: ${f.id}, size: ${f.size || 0} bytes)`);
        }
    }
}

inspect().catch(err => {
    console.error('Error during inspect:', err);
});
