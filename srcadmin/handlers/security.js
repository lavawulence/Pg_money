const { getDb } = require('../database/db');
const { ADMINS, UNLIMITED_POINTS } = require('../config/admin');

// Vérifier si un numéro est admin
function isAdmin(whatsappNumber) {
    return ADMINS.includes(whatsappNumber);
}

async function validateUser(whatsappNumber) {
    const db = getDb();
    
    // Vérifier si c'est l'admin
    const isUserAdmin = isAdmin(whatsappNumber);
    
    // Vérifier les doublons
    let user = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', whatsappNumber);
    
    if (!user) {
        // Créer nouvel utilisateur
        await db.run('INSERT INTO users (whatsapp_number, balance, is_admin) VALUES (?, ?, ?)', 
            whatsappNumber, 
            isUserAdmin ? 999999999 : 0,
            isUserAdmin ? 1 : 0
        );
        user = await db.get('SELECT * FROM users WHERE whatsapp_number = ?', whatsappNumber);
    }
    
    // Pour l'admin, pas de limites
    if (isUserAdmin) {
        return { 
            valid: true, 
            user: { 
                ...user, 
                balance: UNLIMITED_POINTS,
                isAdmin: true 
            }
        };
    }
    
    // Vérifier limites journalières pour les non-admins
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
    
    // Les admins n'ont pas de limite anti-spam
    if (isAdmin(whatsappNumber)) {
        return { valid: true };
    }
    
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

module.exports = { validateUser, checkSpam, isAdmin };