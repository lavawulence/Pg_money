const { getDb } = require('../database/db');
const { isAdminActive, isMainAdminNumber } = require('./auth');
const { handleTransaction, handleBalance, handleHistory } = require('./transactions');

const COMMAND_PREFIX = '$';
const HELP_MESSAGE = `📚 *COMMANDES DISPONIBLES*

💰 *Transactions*
──────────────────
${COMMAND_PREFIX}balance - Voir votre solde
${COMMAND_PREFIX}pay @user [montant] - Envoyer des PG
${COMMAND_PREFIX}history - Historique des transactions

👑 *Admin (LAVAWULE)*
──────────────────
${COMMAND_PREFIX}login LAVAWULE - Devenir admin
${COMMAND_PREFIX}addpoints @user [montant] - Ajouter des points
${COMMAND_PREFIX}removepoints @user [montant] - Retirer des points
${COMMAND_PREFIX}allusers - Liste des utilisateurs
${COMMAND_PREFIX}stats - Statistiques du bot
${COMMAND_PREFIX}logout - Quitter mode admin

📌 *Exemple*
──────────────────
${COMMAND_PREFIX}pay @242044106401 50`;

async function handleCommand(sock, sender, senderNumber, command, args) {
    const db = getDb();
    
    switch(command) {
        // ========== COMMANDES DE BASE ==========
        
        case 'help':
            await sock.sendMessage(sender, { text: HELP_MESSAGE });
            break;
            
        case 'balance':
            const balance = await handleBalance(senderNumber);
            const isAdmin = isAdminActive(senderNumber);
            const balanceMsg = isAdmin 
                ? `👑 *SOLDE ADMIN*\n\n💰 Points: ∞ (Illimité)\n🔐 Code: LAVAWULE`
                : `💰 *VOTRE SOLDE*\n\n📊 Points: ${balance} PG`;
            await sock.sendMessage(sender, { text: balanceMsg });
            break;
            
        case 'history':
            const history = await handleHistory(senderNumber);
            await sock.sendMessage(sender, { text: history });
            break;
            
        case 'pay':
            if (args.length < 2) {
                await sock.sendMessage(sender, { 
                    text: `❌ Usage: ${COMMAND_PREFIX}pay @utilisateur montant\nExemple: ${COMMAND_PREFIX}pay @242044106401 50` 
                });
                return;
            }
            
            let to = args[0].replace('@', '');
            const amount = parseInt(args[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await sock.sendMessage(sender, { text: '❌ Montant invalide !' });
                return;
            }
            
            const result = await handleTransaction(senderNumber, to, amount);
            await sock.sendMessage(sender, { text: result.message });
            break;
            
        // ========== COMMANDES ADMIN ==========
        
        case 'login':
            if (args.length < 1) {
                await sock.sendMessage(sender, { 
                    text: `❌ Usage: ${COMMAND_PREFIX}login [code]` 
                });
                return;
            }
            
            const { verifyAdminCode } = require('./auth');
            const loginResult = await verifyAdminCode(senderNumber, args[0]);
            await sock.sendMessage(sender, { text: loginResult.message });
            break;
            
        case 'addpoints':
            if (!isAdminActive(senderNumber)) {
                await sock.sendMessage(sender, { text: '❌ Commande admin réservée. Utilisez $login LAVAWULE d\'abord.' });
                return;
            }
            
            if (args.length < 2) {
                await sock.sendMessage(sender, { 
                    text: `❌ Usage: ${COMMAND_PREFIX}addpoints @utilisateur montant` 
                });
                return;
            }
            
            let addUser = args[0].replace('@', '');
            const pointsToAdd = parseInt(args[1]);
            
            await db.run('UPDATE users SET balance = balance + ? WHERE whatsapp_number = ?', pointsToAdd, addUser);
            await sock.sendMessage(sender, { text: `✅ ${pointsToAdd} PG ajoutés à ${addUser}` });
            break;
            
        case 'removepoints':
            if (!isAdminActive(senderNumber)) {
                await sock.sendMessage(sender, { text: '❌ Commande admin réservée.' });
                return;
            }
            
            if (args.length < 2) {
                await sock.sendMessage(sender, { 
                    text: `❌ Usage: ${COMMAND_PREFIX}removepoints @utilisateur montant` 
                });
                return;
            }
            
            let removeUser = args[0].replace('@', '');
            const pointsToRemove = parseInt(args[1]);
            
            await db.run('UPDATE users SET balance = balance - ? WHERE whatsapp_number = ?', pointsToRemove, removeUser);
            await sock.sendMessage(sender, { text: `✅ ${pointsToRemove} PG retirés de ${removeUser}` });
            break;
            
        case 'allusers':
            if (!isAdminActive(senderNumber)) {
                await sock.sendMessage(sender, { text: '❌ Commande admin réservée.' });
                return;
            }
            
            const users = await db.all('SELECT whatsapp_number, balance FROM users ORDER BY balance DESC LIMIT 20');
            
            if (users.length === 0) {
                await sock.sendMessage(sender, { text: '📭 Aucun utilisateur trouvé.' });
                return;
            }
            
            let userList = '👥 *LISTE DES UTILISATEURS*\n\n';
            users.forEach((user, index) => {
                userList += `${index + 1}. ${user.whatsapp_number}\n   💰 ${user.balance} PG\n\n`;
            });
            
            await sock.sendMessage(sender, { text: userList });
            break;
            
        case 'stats':
            if (!isAdminActive(senderNumber)) {
                await sock.sendMessage(sender, { text: '❌ Commande admin réservée.' });
                return;
            }
            
            const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
            const totalPoints = await db.get('SELECT SUM(balance) as total FROM users');
            const totalTransactions = await db.get('SELECT COUNT(*) as count FROM transactions');
            
            const statsMsg = `📊 *STATISTIQUES DU BOT*
            
👥 Utilisateurs: ${totalUsers.count}
💰 Points totaux: ${totalPoints.total || 0} PG
📝 Transactions: ${totalTransactions.count}
👑 Admin: Connecté (LAVAWULE)

🤖 Bot actif ✅`;
            
            await sock.sendMessage(sender, { text: statsMsg });
            break;
            
        case 'logout':
            const { logoutAdmin } = require('./auth');
            const logoutResult = logoutAdmin(senderNumber);
            await sock.sendMessage(sender, { text: logoutResult.message });
            break;
            
        default:
            await sock.sendMessage(sender, { 
                text: `❌ Commande inconnue. Envoyez ${COMMAND_PREFIX}help pour voir les commandes disponibles.` 
            });
    }
}

module.exports = { handleCommand };