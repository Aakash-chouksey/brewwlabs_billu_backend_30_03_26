const nodemailer = require('nodemailer');
const crypto = require('crypto');
const config = require('../../config/config');

// Configure Nodemailer Transporter
// TODO: Move credentials to .env
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your preferred service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Generate a 6-digit OTP and expiration time
 * @returns {Object} { code, expiresAt }
 */
const generateOTP = () => {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    return { code, expiresAt };
};

/**
 * Send OTP via Email
 * @param {string} email 
 * @param {string} otp 
 */
const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Login OTP',
        text: `Your OTP for login is: ${otp}. It expires in 5 minutes.`
    };

    try {
        // Log OTP in dev for convenience, but STILL send the email (or maybe just log if we want to save quota? 
        // User asked to fix it with provided creds, so they likely want the email sent).
        if (config.nodeEnv === 'development') {
            console.log(`[DEV] OTP for ${email}: ${otp}`);
        }
        
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = {
    generateOTP,
    sendOTPEmail
};
