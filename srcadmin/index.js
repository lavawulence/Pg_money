const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const qrcode = require('qrcode-terminal');
const { handleTransaction, handleBalance, handleHistory, handleAddPoints, handleRemovePoints } = require('./handlers/transactions');
const { validateUser, checkLimits, isAdmin } = require('./handlers/security');
const Database = require('./database/db');
const { COMMAND_PREFIX } = require('./config/admin');

const logger = Pino({ level: 'info' });
let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: ['PG Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('🎯 Scannez ce QR code avec WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot WhatsApp connecté!');
            console.log('👑 Mode Admin activé pour: 242044106402');
            console.log('💬 Commandes disponibles:');
            console.log(`   ${COMMAND_PREFIX}pay @user 10 - Envoyer des PG`);
            console.log(`   ${COMMAND_PREFIX}balance - Voir solde`);
            console.log(`   ${COMMAND_PREFIX}history - Historique`);
            console.log(`   ${COMMAND_PREFIX}addpoints @user 100 - Ajouter PG (Admin)`);
            console.log(`   ${COMMAND_PREFIX}removepoints @user 50 - Retirer PG (Admin)`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        await handleIncomingMessage(sender, text);
    });
}

async function handleIncomingMessage(sender, text) {
    // Extraire le numéro du sender (format: 242044106402@s.whatsapp.net)
    const senderNumber = sender.split('@')[0];
    console.log(`📨 Message de ${senderNumber}: ${text}`);

    // Vérifier si la commande commence par $
    if (!text.startsWith(COMMAND_PREFIX)) return;

    // Enlever le préfixe et convertir en minuscules
    const command = text.slice(1).toLowerCase();
    
    // Commande $pay
    if (command.startsWith('pay')) {
        const parts = command.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(sender, { text: '❌ Usage: $pay @utilisateur montant\nExemple: $pay 242044106401 50' });
            return;
        }
        
        let to = parts[1];
        // Enlever le @ si présent
        to = to.replace('@', '');
        const amount = parseInt(parts[2]);
        
        if (isNaN(amount) || amount <= 0) {
            await sock.sendMessage(sender, { text: '❌ Montant invalide!' });
            return;
        }
        
        const result = await handleTransaction(senderNumber, to, amount);
        await sock.sendMessage(sender, { text: result.message });
    }
    
    // Commande $balance
    else if (command === 'balance') {
        const balance = await handleBalance(senderNumber);
        await sock.sendMessage(sender, { text: `💰 Votre solde: ${balance === Infinity ? '∞ (Admin)' : balance + ' PG'}` });
    }
    
    // Commande $history
    else if (command === 'history') {
        const history = await handleHistory(senderNumber);
        await sock.sendMessage(sender, { text: history });
    }
    
    // Commande $addpoints (Admin uniquement)
    else if (command.startsWith('addpoints')) {
        const parts = command.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(sender, { text: '❌ Usage: $addpoints @utilisateur montant\nExemple: $addpoints @242044106401 100' });
            return;
        }
        
        let to = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        
        const result = await handleAddPoints(senderNumber, to, amount);
        await sock.sendMessage(sender, { text: result.message });
    }
    
    // Commande $removepoints (Admin uniquement)
    else if (command.startsWith('removepoints')) {
        const parts = command.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(sender, { text: '❌ Usage: $removepoints @utilisateur montant\nExemple: $removepoints @242044106401 50' });
            return;
        }
        
        let to = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        
        const result = await handleRemovePoints(senderNumber, to, amount);
        await sock.sendMessage(sender, { text: result.message });
    }
    
    // Commande $help
    else if (command === 'help') {
        const helpText = `📚 *Commandes du bot PG*
        
${COMMAND_PREFIX}pay @user [montant] - Envoyer des PG
${COMMAND_PREFIX}balance - Voir votre solde
${COMMAND_PREFIX}history - Voir historique

👑 *Commandes Admin* (vous uniquement):
${COMMAND_PREFIX}addpoints @user [montant] - Ajouter des PG
${COMMAND_PREFIX}removepoints @user [montant] - Retirer des PG

📌 *Exemples*:
${COMMAND_PREFIX}pay @242044106401 50
${COMMAND_PREFIX}addpoints @242044106401 1000`;
        
        await sock.sendMessage(sender, { text: helpText });
    }
    
    // Confirmation de code (sans préfixe)
    else if (command.toUpperCase().startsWith('CONFIRM')) {
        const code = command.split(' ')[1];
        if (code) {
            const { confirmTransaction } = require('./handlers/transactions');
            const result = await confirmTransaction(code);
            await sock.sendMessage(sender, { text: result.message });
        }
    }
}

connectToWhatsApp();