// --- GLOBAL STATE TAMBAHAN ---
let deviceLinked = false;       // apakah sudah ada device tersambung
let currentDevice = "-";        // simpan ID device tersambung

// START BOT (modifikasi menu awal)
async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi")
        const { version } = await fetchLatestBaileysVersion()

        const axiom = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: "silent" })
        })

        global.axiom = axiom

        // Tampilkan menu awal untuk pilih QR atau pairing
        console.log("\nPilih metode login:")
        console.log("1) Scan QR")
        console.log("2) Request Pairing Code")
        const choice = await new Promise(res => {
            rl.question("Pilih 1/2: ", res)
        })

        if (choice === "1") {
            console.log("Silakan scan QR di terminal...")
        } else if (choice === "2") {
            try {
                const code = await axiom.requestPairingCode(`${globalOwnerNumber}@s.whatsapp.net`)
                console.log(`Pairing code: ${code}`)
            } catch (e) {
                console.log("Gagal request pairing code:", e.message)
            }
        } else {
            console.log("Pilihan tidak valid, lanjut dengan QR default.")
        }

        setupMenu(axiom)  // setup panel interaktif
        panel("Menunggu koneksi...", "Belum Login")

        // CONNECTION EVENTS
        axiom.ev.on("connection.update", async (update) => {
            const { qr, connection, lastDisconnect } = update

            if (qr && !deviceLinked) {
                global.lastQR = qr
                console.log("\nScan QR ini di WhatsApp:")
                qrcode.generate(qr, { small: true })
            }

            if (connection === "open") {
                deviceLinked = true
                currentDevice = axiom.user.id.split(":")[0]
                panel(green("Terhubung ✓"), currentDevice)
            }

            if (connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode
                if (code === 401) {
                    console.log(red("Session invalid! Menghapus auth..."))
                    try { fs.rmSync("./axiomSesi", { recursive: true, force: true }) } catch {}
                    return restartBot()
                }
                deviceLinked = false
                currentDevice = "-"
                if (!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus, reconnect..."), "Reconnect")
                    setTimeout(() => startBot(), 2500)
                }
            }
        })

        axiom.ev.on("creds.update", saveCreds)

        // TERMINAL MENU MODIFIKASI
        rl.removeAllListeners("line")
        rl.on("line", async (input) => {
            switch (input.trim()) {
                case "1":
                    console.log(red("\n→ Restarting bot...\n"))
                    restartBot()
                    break
                case "2":
                    panel("Terhubung ✓", currentDevice)
                    break
                case "3":
                    if (deviceLinked) {
                        console.log(yellow(`QR/pairing sedang tersambung ke ${currentDevice}, tidak bisa tautkan baru.`))
                    } else {
                        console.log(green("Tautkan perangkat baru: pilih QR atau pairing"))
                        const method = await new Promise(res => {
                            rl.question("1) QR  2) Pairing: ", res)
                        })
                        if (method === "1") {
                            if (global.lastQR) qrcode.generate(global.lastQR, { small: true })
                            else console.log(red("Tidak ada QR."))
                        } else if (method === "2") {
                            try {
                                const code = await axiom.requestPairingCode(`${globalOwnerNumber}@s.whatsapp.net`)
                                console.log("Pairing code:", code)
                            } catch (e) {
                                console.log("Gagal request pairing code:", e.message)
                            }
                        } else {
                            console.log(yellow("Pilihan tidak valid."))
                        }
                    }
                    break
                case "4":
                    console.log(red("→ Keluar bot"))
                    process.exit(0)
                    break
                case "5":
                    panel("Terhubung ✓", currentDevice, "-", true)
                    break
                default:
                    console.log(yellow("Perintah tidak dikenal."))
            }
        })

    } catch (e) {
        console.log(red("Startup Error:"), e)
        setTimeout(startBot, 2000)
    }
}