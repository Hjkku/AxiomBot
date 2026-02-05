const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    generatePairingCode
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');

// ======== READLINE SETUP ========
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const ask = (q) => new Promise(res => rl.question(q, res));

// ======== STATUS VARIABLE ========
let connected = false;

// ======== START SOCKET FUNCTION ========
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Safari'),
        auth: state
    });

    // ======== CONNECTION UPDATE ========
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            console.log('\nQR CODE TERSEDIA! Scan cepat!\n');
            console.log(qr);
        }

        if (connection === 'open') {
            connected = true;
            console.log('\n=== BOT TERHUBUNG ===\n');
        }

        if (connection === 'close') {
            connected = false;
            console.log('\nKoneksi terputus, mencoba menyambung ulang...\n');
            start();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ======== MENU INTERAKTIF ========
    async function menu() {
        while (true) {
            console.clear();
            console.log("=== BOT WHATSAPP TERMINAL ===");
            console.log("Status:", connected ? "TERHUBUNG" : "TIDAK TERHUBUNG");
            console.log("==============================");
            console.log("1. Kirim Pesan");
            console.log("2. Cek Latency");
            console.log("3. Tautkan Perangkat (QR / Pairing)");
            console.log("4. Matikan Bot");
            console.log("5. Logout Auth (Putuskan Sambungan)");
            console.log("6. Source / Credits");
            console.log("==============================");

            const pilih = await ask("Pilih menu: ");

            // === MENU 1: Kirim Pesan ===
            if (pilih === '1') {
                const nomor = await ask("Nomor (628xx): ");
                const pesan = await ask("Pesan: ");
                await sock.sendMessage(nomor + '@s.whatsapp.net', { text: pesan });
                console.log("Terkirim!");
                await ask("ENTER...");
            }

            // === MENU 2: Cek Latency ===
            else if (pilih === '2') {
                const start = Date.now();
                await sock.sendMessage(sock.user.id, { text: 'ping' });
                const ping = Date.now() - start;
                console.log("Latency:", ping, "ms");
                await ask("ENTER...");
            }

            // === MENU 3: TAUTKAN PERANGKAT ===
            else if (pilih === '3') {
                if (connected) {
                    console.log("Bot sudah terhubung. Tidak bisa pairing.");
                    await ask("ENTER...");
                } else {
                    console.log("\n1. QR Code");
                    console.log("2. Pairing Code\n");
                    const pilihMetode = await ask("Pilih metode: ");

                    if (pilihMetode === '1') {
                        console.log("\nQR akan tampil otomatis saat koneksi update.\n");
                        await ask("ENTER...");
                    }

                    if (pilihMetode === '2') {
                        const nomor = await ask("Masukkan nomor (62xxxxxxxx): ");
                        const code = await generatePairingCode(sock, nomor);
                        console.log("\nPAIRING CODE:", code);
                        console.log("Masukkan di HP untuk login.\n");
                        await ask("ENTER...");
                    }
                }
            }

            // === MENU 4: Matikan Bot ===
            else if (pilih === '4') {
                console.log("Mematikan bot...");
                process.exit();
            }

            // === MENU 5: LOGOUT AUTH ===
            else if (pilih === '5') {
                try {
                    fs.rmSync('./auth', { recursive: true, force: true });
                    console.log("Logout berhasil! Data auth dihapus.");
                } catch {}
                await ask("ENTER...");
            }

            // === MENU 6: Source / Credits ===
            else if (pilih === '6') {
                console.log("Author: Rangga");
                console.log("Script Writer: ChatGPT");
                console.log("Desain: Rangga & ChatGPT");
                console.log("Thanks: Baileys Team");
                await ask("ENTER...");
            }
        }
    }

    menu();
}

start();
