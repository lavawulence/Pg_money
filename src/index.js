const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const qrcode = require('qrcode-terminal');
const { handleTransaction, handleBalance, handleHistory } = require('./handlers/transactions');
const { validateUser, checkLimits } = require('./handlers/security');
const Database = require('./database/db');

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
    console.log(`📨 Message de ${sender}: ${text}`);

    // Commande /pay
    if (text.startsWith('/pay')) {
        const [_, to, amount] = text.split(' ');
        const result = await handleTransaction(sender, to, parseInt(amount));
        await sock.sendMessage(sender, { text: result.message });
    }
    
    // Commande /balance
    else if (text === '/balance') {
        const balance = await handleBalance(sender);
        await sock.sendMessage(sender, { text: `💰 Votre solde: ${balance} PG` });
    }
    
    // Commande /history
    else if (text === '/history') {
        const history = await handleHistory(sender);
        await sock.sendMessage(sender, { text: history });
    }
    
    // Confirmation de code
    else if (text.startsWith('CONFIRM')) {
        const code = text.split(' ')[1];
        // Logique de validation
    }
}

connectToWhatsApp();