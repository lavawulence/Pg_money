const { getDb } = require('../database/db');

async function validateUser(whatsappNumber) {
    const db = getDb();
    
    // Vérifier les doublons
    const user = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', whatsappNumber);
    
    if (!user) {
        // Créer nouvel utilisateur
        await db.run('INSERT INTO users (whatsapp_number) VALUES (?)', whatsappNumber);
        return { valid: true, user: { number: whatsappNumber, balance: 0 } };
    }
    
    // Vérifier limites journalières
    const today = new Date().toISOString().split('T')[0];
    if (user.last_reset !== today) {
        await db.run('UPDATE users SET daily_used = 0, last_reset = ? WHERE whatsapp_number = ?', today, whatsappNumber);
        user.daily_used = 0;
    }
    
    if (user.daily_used >= user.daily_limit) {
        return { valid: false, message: '❌ Limite journalière atteinte (100 PG)' };
    }
    
    return { valid: true, user };
}

async function checkSpam(whatsappNumber) {
    const db = getDb();
    const recent = await db.get(`
        SELECT COUNT(*) as count FROM transactions 
        WHERE from_user = ? AND timestamp > datetime('now', '-1 minute')
    `, whatsappNumber);
    
    if (recent.count > 5) {
        await db.run('INSERT INTO security_logs (user_number, action) VALUES (?, ?)', whatsappNumber, 'SPAM_DETECTED');
        return { valid: false, message: '❌ Trop de transactions. Attendez une minute.' };
    }
    
    return { valid: true };
}

module.exports = { validateUser, checkSpam };