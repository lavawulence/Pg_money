const { getDb } = require('../database/db');
const { validateUser, checkSpam, isAdmin } = require('./security');
const crypto = require('crypto');

function generateConfirmationCode() {
    return crypto.randomInt(100000, 999999).toString();
}

async function handleTransaction(from, to, amount) {
    const db = getDb();
    
    // Validation
    const fromUser = await validateUser(from);
    if (!fromUser.valid) return { message: fromUser.message };
    
    // Les admins peuvent envoyer même sans solde (virtuellement illimité)
    if (!isAdmin(from) && fromUser.user.balance < amount) {
        return { message: '❌ Solde insuffisant!' };
    }
    
    const toUser = await validateUser(to);
    
    const spamCheck = await checkSpam(from);
    if (!spamCheck.valid) return { message: spamCheck.message };
    
    // Code de confirmation
    const code = generateConfirmationCode();
    const transactionId = crypto.randomUUID();
    
    // Sauvegarder transaction
    await db.run(`
        INSERT INTO transactions (id, from_user, to_user, amount, status, confirmation_code)
        VALUES (?, ?, ?, ?, ?, ?)
    `, transactionId, from, to, amount, 'PENDING', code);
    
    return { 
        message: `🔐 *Code de confirmation:* ${code}\n\nRépondez avec: *CONFIRM ${code}*\n⚠️ Valable 5 minutes`,
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
    if (!isAdmin(transaction.from_user)) {
        await db.run('UPDATE users SET balance = balance - ? WHERE whatsapp_number = ?', transaction.amount, transaction.from_user);
    }
    await db.run('UPDATE users SET balance = balance + ? WHERE whatsapp_number = ?', transaction.amount, transaction.to_user);
    
    if (!isAdmin(transaction.from_user)) {
        await db.run('UPDATE users SET daily_used = daily_used + ? WHERE whatsapp_number = ?', transaction.amount, transaction.from_user);
    }
    
    await db.run('UPDATE transactions SET status = "COMPLETED" WHERE id = ?', transaction.id);
    
    return { message: `✅ *Transfert confirmé!* ${transaction.amount} PG envoyés à ${transaction.to_user}` };
}

async function handleBalance(whatsappNumber) {
    const db = getDb();
    
    if (isAdmin(whatsappNumber)) {
        return Infinity;
    }
    
    const user = await db.get('SELECT balance FROM users WHERE whatsapp_number = ?', whatsappNumber);
    return user ? user.balance : 0;
}

async function handleHistory(whatsappNumber) {
    const db = getDb();
    const transactions = await db.all(`
        SELECT * FROM transactions 
        WHERE from_user = ? OR to_user = ? 
        ORDER BY timestamp DESC 
        LIMIT 10
    `, whatsappNumber, whatsappNumber);
    
    if (transactions.length === 0) {
        return '📭 Aucune transaction trouvée';
    }
    
    let history = '📜 *Historique des transactions*\n\n';
    for (const tx of transactions) {
        const type = tx.from_user === whatsappNumber ? '📤 ENVOYÉ' : '📥 REÇU';
        const other = tx.from_user === whatsappNumber ? tx.to_user : tx.from_user;
        history += `${type} ${tx.amount} PG ${type === '📤 ENVOYÉ' ? 'vers' : 'de'} ${other}\n`;
        history += `🕐 ${new Date(tx.timestamp).toLocaleString()}\n`;
        history += `🔖 Statut: ${tx.status}\n\n`;
    }
    
    return history;
}

async function handleAddPoints(adminNumber, userNumber, amount) {
    const db = getDb();
    
    if (!isAdmin(adminNumber)) {
        return { message: '❌ Accès refusé. Réservé aux administrateurs.' };
    }
    
    await db.run('UPDATE users SET balance = balance + ? WHERE whatsapp_number = ?', amount, userNumber);
    
    // Log admin action
    await db.run(`
        INSERT INTO security_logs (user_number, action) 
        VALUES (?, ?)
    `, adminNumber, `ADDED_${amount}_POINTS_TO_${userNumber}`);
    
    return { message: `✅ ${amount} PG ajoutés à ${userNumber}` };
}

async function handleRemovePoints(adminNumber, userNumber, amount) {
    const db = getDb();
    
    if (!isAdmin(adminNumber)) {
        return { message: '❌ Accès refusé. Réservé aux administrateurs.' };
    }
    
    await db.run('UPDATE users SET balance = balance - ? WHERE whatsapp_number = ?', amount, userNumber);
    
    // Log admin action
    await db.run(`
        INSERT INTO security_logs (user_number, action) 
        VALUES (?, ?)
    `, adminNumber, `REMOVED_${amount}_POINTS_FROM_${userNumber}`);
    
    return { message: `✅ ${amount} PG retirés de ${userNumber}` };
}

module.exports = { 
    handleTransaction, 
    confirmTransaction, 
    handleBalance, 
    handleHistory,
    handleAddPoints,
    handleRemovePoints
};