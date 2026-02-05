const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")

// GLOBAL STATE
let startTime = Date.now()
let msgCount = 0
let errCount = 0
let lastLog = "-"
let lastCPU = 0
let reconnecting = false
global.sock = null
let loggedIn = false

// CPU USAGE
let lastCPUTime = process.cpuUsage()
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = (
        (now.user - lastCPUTime.user + now.system - lastCPUTime.system) / 1000
    ).toFixed(1)
    lastCPUTime = now
}, 1000)

// HELPERS
function formatUptime(ms) {
    let s = Math.floor(ms / 1000)
    let m = Math.floor(s / 60)
    let h = Math.floor(m / 60)
    s %= 60
    m %= 60
    return `${h}h ${m}m ${s}s`
}

function getRam() {
    return (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"
}

function green(t) { return `\x1b[32m${t}\x1b[0m` }
function red(t) { return `\x1b[31m${t}\x1b[0m` }
function yellow(t) { return `\x1b[33m${t}\x1b[0m` }

// PANEL
function panel(status, device, ping = "-", showSource = false) {
    console.clear()
    console.log(`
┌──────────────────────────────────────────────┐
│          ${green("WHATSAPP BOT PANEL ULTRA")}           │
├──────────────────────────────────────────────┤
│ Status : ${status}
│ Device : ${device}
│ Uptime : ${formatUptime(Date.now() - startTime)}
│ CPU    : ${lastCPU} ms
│ RAM    : ${getRam()}
│ Ping   : ${ping}
│ Msg In : ${msgCount}
│ Errors : ${errCount}
├──────────────────────────────────────────────┤
│ Menu Interaktif:
│ 1) Restart Bot
│ 2) Refresh Panel
│ 3) Tautkan Perangkat
│ 4) Matikan Bot
│ 5) Logout WhatsApp
│ 6) Source
├──────────────────────────────────────────────┤
│ Log Terakhir:
│ ${yellow(lastLog)}
${showSource ? `
├──────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: ChatGPT
│ Designer     : Rangga & ChatGPT
│ Versi Bot    : Ultra Low RAM v3.0
` : ""}
└──────────────────────────────────────────────┘
`)
}

// TERMINAL INPUT
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function ask(q) {
    return new Promise(resolve => rl.question(q, resolve))
}

function setupMenu(sock) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {

        switch (input.trim()) {
            case "1":
                console.log(red("\n→ Restarting bot...\n"))
                restartBot()
                break

            case "2":
                panel(
                    loggedIn ? green("Terhubung ✓") : red("Tidak Terhubung"),
                    loggedIn ? sock?.user?.id?.split(":")[0] : "-",
                    "-"
                )
                break

            case "3":
                await menuTautkan(sock)
                break

            case "4":
                console.log(red("→ Mematikan bot..."))
                process.exit(0)
                break

            case "5":
                console.log(red("→ Logout WhatsApp, menghapus session..."))
                try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                console.log(green("→ Session dihapus. Silakan tautkan ulang."))
                restartBot()
                break

            case "6":
                panel(
                    loggedIn ? green("Terhubung ✓") : red("Tidak Terhubung"),
                    loggedIn ? sock?.user?.id?.split(":")[0] : "-",
                    "-",
                    true
                )
                break

            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}


// =============== MENU TAUTKAN PERANGKAT ==================
async function menuTautkan(sock) {

    if (loggedIn) {
        console.log(red("\n→ Sudah terhubung, tidak bisa tautkan ulang.\n"))
        return
    }

    console.log(`
Pilih metode:
1) QR Code
2) Pairing Code
`)

    const pilih = await ask("> ")

    if (pilih === "1") {
        if (global.lastQR) qrcode.generate(global.lastQR, { small: true })
        else console.log(red("→ Tunggu QR muncul otomatis..."))
    }

    else if (pilih === "2") {
        const number = await ask("Masukkan nomor WhatsApp (628xxxx): ")

        console.log(green("→ Membuat pairing code..."))

        try {
            const code = await global.sock.requestPairingCode(number)

            console.log(`
────────────────────────────
 Pairing Code: ${green(code)}
────────────────────────────
Masukkan di WhatsApp → Tautkan Perangkat
`)
        } catch (err) {
            console.log(red("Gagal membuat pairing code! Fallback QR."))

            if (global.lastQR) qrcode.generate(global.lastQR, { small: true })
        }
    }
}



// INTERNAL RESTART
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    lastLog = "-"
    loggedIn = false

    delete require.cache[require.resolve("./axiom.js")]
    startBot()
}



// ====================== START BOT ==========================
async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("./auth")
        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: "silent" })
        })

        global.sock = sock
        setupMenu(sock)

        panel(red("Tidak Terhubung"), "-")

        // CONNECTION EVENTS
        sock.ev.on("connection.update", async (update) => {
            const { qr, connection, lastDisconnect } = update

            if (qr && !loggedIn) {
                global.lastQR = qr
                panel(red("Scan QR!"), "-")
                qrcode.generate(qr, { small: true })
            }

            if (connection === "open") {
                loggedIn = true
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0])
            }

            if (connection === "close") {
                loggedIn = false

                const code = lastDisconnect?.error?.output?.statusCode

                if (code === 401) {
                    console.log(red("Session invalid, menghapus auth..."))
                    try { fs.rmSync("./auth", { recursive: true, force: true }) } catch {}
                    return restartBot()
                }

                panel(red("Terputus, reconnect..."), "-")
                setTimeout(() => startBot(), 2000)
            }
        })

        sock.ev.on("creds.update", saveCreds)

        // HANDLE PESAN
        sock.ev.on("messages.upsert", async ({ messages }) => {
            if (!loggedIn) return

            const msg = messages[0]
            if (!msg.message) return

            if (!msg.key.fromMe) msgCount++

            const from = msg.key.remoteJid
            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                ""

            lastLog = `${from} → ${text}`
            panel(green("Terhubung ✓"), sock.user.id.split(":")[0])

            if (text === "ping") {
                let t = Date.now()
                await sock.sendMessage(from, { text: "pong!" })
                let ping = Date.now() - t
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0], ping + " ms")
            }
        })

    } catch (e) {
        console.log(red("Startup Error:"), e)
        setTimeout(startBot, 2000)
    }
}

startBot()