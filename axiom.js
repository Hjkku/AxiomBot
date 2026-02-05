const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const readline = require("readline");
const { Boom } = require("@hapi/boom");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(q) {
    return new Promise(res => rl.question(q, res));
}

let isPairing = false;

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        if (qr && !isPairing) {
            console.clear();
            console.log("\n=== SCAN QR ===\n");
            console.log(qr);
        }

        if (pairingCode) {
            console.clear();
            console.log("\n=== PAIRING CODE ===\n");
            console.log(pairingCode);
        }

        if (connection === "open" && !isPairing) {
            console.clear();
            console.log("Bot berhasil terhubung.\n");
        }

        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                start();
            } else {
                console.log("Session logout.");
            }
        }
    });

    menu(sock);
}

async function menu(sock) {
    while (true) {
        console.log("\n=== PANEL BOT ===");
        console.log("[1] Scan QR");
        console.log("[2] Pairing Code (Gabungan Manual + Otomatis)");
        console.log("[3] Check Device");
        console.log("[4] Matikan Bot");
        console.log("[5] Putuskan Sesi (Logout Auth)");
        console.log("[6] Source Code");
        const choose = await ask("Pilih: ");

        if (choose == "1") {
            isPairing = false;
            console.clear();
            console.log("Tampilkan QR...");
        }

        if (choose == "2") {
            isPairing = true;
            console.clear();
            let number = await ask("Masukkan nomor (tanpa +62): ");
            number = number.replace(/\D/g, "");
            number = "+62" + number;

            try {
                console.log("Cek support pairing...");
                const code = await sock.requestPairingCode(number);

                if (code) {
                    console.log("\n=== PAIRING CODE ===\n");
                    console.log(code);
                } else {
                    console.log("Nomor tidak support pairing, tampilkan QR.");
                    isPairing = false;
                }
            } catch (e) {
                console.log("Gagal membuat pairing code.");
                isPairing = false;
            }
        }

        if (choose == "3") {
            console.clear();
            try {
                let me = sock.user?.id || "Belum terhubung.";
                console.log("Device:", me);
            } catch {
                console.log("Error membaca device.");
            }
        }

        if (choose == "4") {
            console.log("Bot dimatikan.");
            process.exit(0);
        }

        if (choose == "5") {
            console.log("Menghapus session...");
            const fs = require("fs");
            fs.rmSync("./session", { recursive: true, force: true });
            console.log("Logout berhasil.");
            process.exit(0);
        }

        if (choose == "6") {
            console.log("Github kamu sendiri lah bang, bukan tugas gua 😹");
        }
    }
}

start();