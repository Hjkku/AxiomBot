const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")
const { Boom } = require("@hapi/boom")

// --- GLOBAL STATE ---
let state = {
    startTime: Date.now(),
    msgCount: 0,
    errCount: 0,
    lastLog: "Sistem Siap",
    lastCPU: "0",
    ping: "-",
    reconnecting: false,
    lastQR: null,
    sock: null
}

// --- CPU MONITORING ---
let lastCPUTime = process.cpuUsage()
setInterval(() => {
    const now = process.cpuUsage()
    const user = now.user - lastCPUTime.user
    const system = now.system - lastCPUTime.system
    state.lastCPU = ((user + system) / 1000).toFixed(1)
    lastCPUTime = now
}, 1000)

// --- HELPERS ---
const formatUptime = (ms) => {
    let s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60)
    return `${h}h ${m % 60}m ${s % 60}s`
}

const getRam = () => (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + " MB"
const color = {
    green: (t) => `\x1b[32m${t}\x1b[0m`,
    red: (t) => `\x1b[31m${t}\x1b[0m`,
    yellow: (t) => `\x1b[33m${t}\x1b[0m`,
    cyan: (t) => `\x1b[36m${t}\x1b[0m`
}

// --- UI PANEL ---
function refreshPanel(status = "Terhubung ✓", showSource = false) {
    console.clear()
    const device = state.sock?.user?.id ? state.sock.user.id.split(":")[0] : "Belum Login"
    
    console.log(`
┌─────────────────────────────────────────────┐
│          ${color.cyan("WHATSAPP BOT PANEL ULTRA")}        │
├─────────────────────────────────────────────┤
│ Status : ${status}
│ Device : ${device}
│ Uptime : ${formatUptime(Date.now() - state.startTime)}
│ CPU    : ${state.lastCPU} ms
│ RAM    : ${getRam()}
│ Ping   : ${state.ping}
│ Msg In : ${state.msgCount}
│ Errors : ${state.errCount}
├─────────────────────────────────────────────┤
│ Menu Interaktif:
│ 1) Restart Bot       2) Refresh Panel
│ 3) Tampilkan QR      4) Keluar/Logout
│ 5) Credits
├─────────────────────────────────────────────┤
│ Log Terakhir:
│ ${color.yellow(state.lastLog)}
${showSource ? `├─────────────────────────────────────────────┤
│ ${color.green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: Gemini & Rangga
│ Versi Bot    : Ultra Low RAM v2.5` : ""}
└─────────────────────────────────────────────┘
`)
}

// --- TERMINAL INTERFACE ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on("line", (input) => {
    switch (input.trim()) {
        case "1": restartBot(); break
        case "2": refreshPanel(); break
        case "3": 
            if (state.lastQR) qrcode.generate(state.lastQR, { small: true })
            else console.log(color.red("QR tidak tersedia atau sudah login."))
            break
        case "4": process.exit(0); break
        case "5": refreshPanel("Info Sistem", true); break
    }
})

// --- CORE FUNCTION ---
async function startBot() {
    const { state: authState, saveCreds } = await useMultiFileAuthState("./auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: authState,
        logger: Pino({ level: "silent" }),
        printQRInTerminal: false // Kita handle manual via panel
    })

    state.sock = sock

    sock.ev.on("connection.update", async (update) => {
        const { qr, connection, lastDisconnect } = update

        if (qr) {
            state.lastQR = qr
            refreshPanel(color.yellow("Menunggu Scan..."))
            qrcode.generate(qr, { small: true })
        }

        if (connection === "open") {
            state.lastQR = null
            state.reconnecting = false
            state.lastLog = "Bot Berhasil Terhubung"
            refreshPanel(color.green("Terhubung ✓"))
        }

        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            state.lastQR = null
            
            if (reason === DisconnectReason.loggedOut) {
                state.lastLog = "Session Logout, menghapus data..."
                fs.rmSync("./auth", { recursive: true, force: true })
                restartBot()
            } else {
                state.lastLog = "Koneksi terputus, mencoba kembali..."
                setTimeout(startBot, 3000)
            }
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        state.msgCount++
        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        
        state.lastLog = `${from.split("@")[0]} : ${text.substring(0, 20)}`
        refreshPanel()

        if (text.toLowerCase() === "ping") {
            const start = Date.now()
            await sock.sendMessage(from, { text: "Pong! 🏓" })
            state.ping = (Date.now() - start) + "ms"
            refreshPanel()
        }
    })
}

function restartBot() {
    state.startTime = Date.now()
    state.msgCount = 0
    state.errCount = 0
    if (state.sock) state.sock.end()
    startBot()
}

// --- ANTI CRASH ---
process.on("uncaughtException", (err) => {
    state.errCount++
    state.lastLog = `Error: ${err.message}`
    refreshPanel(color.red("Critical Error!"))
})

// Menjalankan Bot
startBot()
