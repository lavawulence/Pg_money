const { getDb } = require('../database/db');
const { isAdminActive } = require('./auth');
const crypto = require('crypto');

function generateConfirmationCode() {
    return crypto.randomInt(100000, 999999).toString();
}

async function handleTransaction(from, to, amount) {
    const db = getDb();
    
    // Vérifier si l'expéditeur existe
    let fromUser = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', from);
    if (!fromUser) {
        await db.run('INSERT INTO users (whatsapp_number, balance) VALUES (?, 0)', from);
        fromUser = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', from);
    }
    
    // Vérifier si le destinataire existe
    let toUser = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', to);
    if (!toUser) {
        await db.run('INSERT INTO users (whatsapp_number, balance) VALUES (?, 0)', to);
        toUser = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', to);
    }
    
    // Vérifier le solde (sauf pour admin)
    const isAdminSender = isAdminActive(from);
    if (!isAdminSender && fromUser.balance < amount) {
        return { message: '❌ Solde insuffisant !' };
    }
    
    // Générer code de confirmation
    const code = generateConfirmationCode();
    const transactionId = crypto.randomUUID();
    
    // Sauvegarder la transaction
    await db.run(`
        INSERT INTO transactions (id, from_user, to_user, amount, status, confirmation_code)
        VALUES (?, ?, ?, ?, ?, ?)
    `, transactionId, from, to, amount, 'PENDING', code);
    
    return {
        message: `🔐 *CODE DE CONFIRMATION*
        
📋 Code: *${code}*
💰 Montant: ${amount} PG
👤 Destinataire: ${to}

⚠️ Valable 5 minutes
💬 Répondez avec: CONFIRM ${code}`,
        transactionId,
        code
    };
}

async function confirmTransaction(confirmationCode) {
    const db = getDb();
    
    const transaction = await db.get(`
        SELECT * FROM transactions 
        WHERE confirmation_code = ? AND status = 'PENDING'
    `, confirmationCode);
    
    if (!transaction) {
        return { message: '❌ Code invalide ou expiré !' };
    }
    
    const isAdminSender = isAdminActive(transaction.from_user);
    
    if (!isAdminSender) {
        await db.run('UPDATE users SET balance = balance - ? WHERE whatsapp_number = ?', 
            transaction.amount, transaction.from_user);
    }
    
    await db.run('UPDATE users SET balance = balance + ? WHERE whatsapp_number = ?', 
        transaction.amount, transaction.to_user);
    
    await db.run('UPDATE transactions SET status = "COMPLETED" WHERE id = ?', transaction.id);
    
    return { 
        message: `✅ *TRANSACTION CONFIRMÉE*
        
💰 ${transaction.amount} PG envoyés à ${transaction.to_user}
🕐 ${new Date().toLocaleString()}`
    };
}

async function handleBalance(whatsappNumber) {
    const db = getDb();
    
    if (isAdminActive(whatsappNumber)) {
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
        return '📭 *AUCUNE TRANSACTION*\n\nVous n\'avez pas encore d\'historique.';
    }
    
    let history = '📜 *HISTORIQUE DES TRANSACTIONS*\n\n';
    
    for (const tx of transactions) {
        const isSender = tx.from_user === whatsappNumber;
        const icon = isSender ? '📤 ENVOYÉ' : '📥 REÇU';
        const other = isSender ? tx.to_user : tx.from_user;
        const sign = isSender ? '-' : '+';
        
        history += `${icon} ${sign}${tx.amount} PG ${isSender ? 'vers' : 'de'} ${other}\n`;
        history += `🕐 ${new Date(tx.timestamp).toLocaleString()}\n`;
        history += `🔖 ${tx.status}\n`;
        history += `───────────────────\n\n`;
    }
    
    return history;
}

module.exports = { handleTransaction, confirmTransaction, handleBalance, handleHistory };