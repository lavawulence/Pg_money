const { getDb } = require('../database/db');
const { validateUser, checkSpam } = require('./security');
const crypto = require('crypto');

function generateConfirmationCode() {
    return crypto.randomInt(100000, 999999).toString();
}

async function handleTransaction(from, to, amount) {
    const db = getDb();
    
    // Validation
    const fromUser = await validateUser(from);
    if (!fromUser.valid) return { message: fromUser.message };
    
    const toUser = await validateUser(to);
    
    const spamCheck = await checkSpam(from);
    if (!spamCheck.valid) return { message: spamCheck.message };
    
    // Vérifier solde
    if (fromUser.user.balance < amount) {
        return { message: '❌ Solde insuffisant!' };
    }
    
    // Code de confirmation
    const code = generateConfirmationCode();
    const transactionId = crypto.randomUUID();
    
    // Sauvegarder transaction
    await db.run(`
        INSERT INTO transactions (id, from_user, to_user, amount, status, confirmation_code)
        VALUES (?, ?, ?, ?, ?, ?)
    `, transactionId, from, to, amount, 'PENDING', code);
    
    return { 
        message: `🔐 Code de confirmation: ${code}\nRépondez avec: CONFIRM ${code}`,
        transactionId,
        code
    };
}

async function confirmTransaction(confirmationCode) {
    const db = getDb();
    const transaction = await db.get('SELECT * FROM transactions WHERE confirmation_code = ? AND status = "PENDING"', confirmationCode);
    
    if (!transaction) {
        return { message: '❌ Code invalide ou expiré' };
    }
    
    // Exécuter transfert
    await db.run('UPDATE users SET balance = balance - ? WHERE whatsapp_number = ?', transaction.amount, transaction.from_user);
    await db.run('UPDATE users SET balance = balance + ? WHERE whatsapp_number = ?', transaction.amount, transaction.to_user);
    await db.run('UPDATE users SET daily_used = daily_used + ? WHERE whatsapp_number = ?', transaction.amount, transaction.from_user);
    await db.run('UPDATE transactions SET status = "COMPLETED" WHERE id = ?', transaction.id);
    
    return { message: `✅ Transfert confirmé! ${transaction.amount} PG envoyés` };
}

async function handleBalance(whatsappNumber) {
    const db = getDb();
    const user = await db.get('SELECT balance FROM users WHERE whatsapp_number = ?', whatsappNumber);
    return user ? user.balance : 0;
}

module.exports = { handleTransaction, confirmTransaction, handleBalance };