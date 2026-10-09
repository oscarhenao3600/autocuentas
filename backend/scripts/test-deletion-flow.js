import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Contract from '../models/Contract.js';
import BillingPeriod from '../models/BillingPeriod.js';
import telegramService from '../services/telegram.service.js';
import * as adminController from '../controllers/admin.controller.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas';

async function runTest() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    try {
        // Create or find a test contractor
        const testCedula = '9999999991';
        let testUser = await User.findOne({ 
            $or: [{ cedula: testCedula }, { email: 'test_habeas_data@alcaldia.gov.co' }] 
        });
        if (!testUser) {
            testUser = await User.create({
                fullName: 'Contratista Prueba Habeas Data',
                email: 'test_habeas_data@alcaldia.gov.co',
                cedula: testCedula,
                password: 'Password123*',
                role: 'client',
                status: 'active',
                isActive: true,
                telegramChatId: '999888777'
            });
        } else {
            testUser.status = 'active';
            testUser.isActive = true;
            testUser.telegramChatId = '999888777';
            testUser.deletionRequest = { requested: false };
            await testUser.save();
        }

        // Mock bot messaging to prevent network errors to non-existent chat
        if (telegramService.bot) {
            telegramService.bot.sendMessage = async (chatId, text, options) => {
                return { message_id: 999 };
            };
            telegramService.bot.editMessageText = async (text, options) => {
                return { message_id: 999 };
            };
            telegramService.bot.answerCallbackQuery = async () => true;
        }

        console.log(`\n--- TEST 1: Contractor requests data deletion via Telegram ---`);
        // Step 1: Click request_delete_data
        await telegramService.handleCallbackQuery({
            id: 'cb_del_1',
            from: { id: 999888777, first_name: 'Contratista' },
            message: { chat: { id: 999888777 }, message_id: 100 },
            data: 'request_delete_data'
        });

        // Step 2: Confirm wanting to submit reason
        await telegramService.handleCallbackQuery({
            id: 'cb_del_2',
            from: { id: 999888777, first_name: 'Contratista' },
            message: { chat: { id: 999888777 }, message_id: 100 },
            data: 'confirm_request_delete_data'
        });

        // Step 3: Simulate contractor typing reason
        const reasonText = 'Ya culminé mi contrato de prestación de servicios y no requiero la plataforma.';
        await telegramService.handleIncomingMessage({
            chat: { id: 999888777 },
            from: { id: 999888777, first_name: 'Contratista' },
            text: reasonText
        });

        const refreshedUser = await User.findById(testUser._id);
        if (refreshedUser.deletionRequest?.requested && refreshedUser.deletionRequest?.reason === reasonText) {
            console.log('✅ TEST 1 passed: Contractor deletion request and reason stored in DB.');
        } else {
            throw new Error(`TEST 1 failed: Deletion request not properly stored: ${JSON.stringify(refreshedUser.deletionRequest)}`);
        }

        console.log(`\n--- TEST 2: Admin executes definitive deletion & purge from Web Platform ---`);
        const mockAdminReq = {
            params: { id: testUser._id.toString() },
            user: { _id: new mongoose.Types.ObjectId(), fullName: 'Administrador Principal QA', email: 'admin@alcaldia.gov.co' },
            body: { reason: 'Solicitud formal de Habeas Data atendida. Terminación de contrato.' }
        };
        let responseCode = 200;
        let responseJson = null;
        const mockAdminRes = {
            status: (code) => {
                responseCode = code;
                return mockAdminRes;
            },
            json: (data) => {
                responseJson = data;
                return mockAdminRes;
            }
        };

        await adminController.deleteUser(mockAdminReq, mockAdminRes);
        console.log('Admin deleteUser response:', responseJson);

        const purgedUser = await User.findById(testUser._id);
        if (!purgedUser.isActive && purgedUser.status === 'inactive' && purgedUser.telegramChatId === null) {
            console.log('✅ TEST 2.1 passed: User inactivated and unlinked from Telegram.');
        } else {
            throw new Error(`TEST 2.1 failed: User status not updated properly: ${purgedUser.status}, isActive: ${purgedUser.isActive}`);
        }

        if (purgedUser.deletionAudit?.deletedByName === 'Administrador Principal QA' && purgedUser.deletionAudit?.reason) {
            console.log('✅ TEST 2.2 passed: Deletion audit record attached to user in DB.');
        } else {
            throw new Error(`TEST 2.2 failed: Deletion audit missing: ${JSON.stringify(purgedUser.deletionAudit)}`);
        }

        // Verify AuditLog collection
        const auditLogEntry = await AuditLog.findOne({
            targetUser: testUser._id,
            action: 'CONTRACTOR_DATA_PURGED'
        }).sort({ createdAt: -1 });

        if (auditLogEntry) {
            console.log('✅ TEST 2.3 passed: AuditLog entry created with id:', auditLogEntry._id);
        } else {
            throw new Error('TEST 2.3 failed: AuditLog entry not found in collection.');
        }

        console.log(`\n--- TEST 3: Admin reactivates contractor ---`);
        const mockReactivateReq = {
            params: { id: testUser._id.toString() },
            user: mockAdminReq.user
        };
        await adminController.reactivateContractor(mockReactivateReq, mockAdminRes);

        const reactivatedUser = await User.findById(testUser._id);
        if (reactivatedUser.isActive && reactivatedUser.status === 'active' && !reactivatedUser.deletionRequest?.requested) {
            console.log('✅ TEST 3 passed: User successfully reactivated.');
        } else {
            throw new Error(`TEST 3 failed: User not reactivated: ${reactivatedUser.status}`);
        }

        console.log('\n🎉 ALL DELETION & AUDIT TESTS PASSED SUCCESSFULLY!\n');
    } catch (err) {
        console.error('❌ Test failed with error:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
