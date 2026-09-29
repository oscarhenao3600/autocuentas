const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const billingController = require('../controllers/billing.controller');
const BillingPeriod = require('../models/BillingPeriod');
const User = require('../models/User');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';

async function testGen() {
    await mongoose.connect(uri);
    const user = await User.findOne({ email: 'oscarhenao3600@gmail.com' });
    const period = await BillingPeriod.findOne({ user: user._id, actNumber: 1 });

    console.log(`Generating package for User: ${user.fullName}, Period: ${period._id}, Act: ${period.actNumber}`);

    // Call generateBillingPackage via req/res mock or internal method
    // In billing.controller, let's see exports
    // Or we can mock req and res for exports.generateDocs
    const req = {
        params: { id: period._id.toString() },
        user: { _id: user._id }
    };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) {
            console.log(`Response status ${this.statusCode}:`, data);
            return this;
        }
    };

    await billingController.generatePackage(req, res);
    process.exit(0);
}

testGen().catch(err => {
    console.error('Error testGen:', err);
    process.exit(1);
});
