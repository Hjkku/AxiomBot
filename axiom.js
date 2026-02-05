const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")

// GLOBAL
let startTime = Date.now()
let msgCount = 0
let errCount = 0
let lastLog = "-"
let reconnecting = false
let pairingInProgress = false
global.sock = null

// CPU USAGE
let lastCPUTime = process.cpuUsage()
let lastCPU = 0
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = ((now.user - lastCPUTime.user + now.system - lastCPUTime.system) / 1000).toFixed(1)
    lastCPUTime = now
}, 1000)

// HELPERS
function uptime(ms) {
    let s = Math.floor(ms / 1000)
    let m = Math.floor(s / 60)
    let h = Math.floor(m / 60)
    return `${h}h ${m % 60}m ${s % 60}s`
}

const green = (t) => `\x1b[32m${t}\x1b[0m`
const red = (t) => `\x1b[31m${t}\x1b[0m`
const yellow = (t) => `\x1b[33m${t}\x1b[0m`

function panel(status, device, ping = "-", showSource = false) {
    console.clear()
    console.log(`
┌───────────────────────────────────────────┐
│            ${green("AXIOM BOT ULTRA V3")}            │
├───────────────────────────────────────────┤
│ Status : ${status}
│ Device : ${device}
│ Uptime : ${uptime(Date.now() - startTime)}
│ CPU    : ${lastCPU} ms
│ RAM    : ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB
│ Ping   : ${ping}
│ Msg In : ${msgCount}
│ Errors : ${errCount}
├───────────────────────────────────────────┤
│ Menu:
│ 1) Restart Bot
│ 2) Refresh Panel
│ 3) Tautkan Perangkat (QR / Pairing)
│ 4) Matikan Bot
│ 5) Logout Auth
│ 6) About / Source
├───────────────────────────────────────────┤
│ Log Terakhir:
│ ${yellow(lastLog)}
${showSource ? `
├───────────────────────────────────────────┤
│ Author        : Rangga
│ Script Writer : ChatGPT
│ Designer      : Rangga & ChatGPT
│ Versi         : AXIOM ULTRA V3
` : ""}
└───────────────────────────────────────────┘
`)
}

// TERMINAL MENU
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function setupMenu(sock) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch (input.trim()) {
            case "1":
                restartBot()
                break

            case "2":
                panel("Terhubung ✓", sock?.user?.id?.split(":")[0] || "-")
                break

            case "3":
                if (sock?.user) {
                    console.log(red("Sudah terhubung! Tidak bisa tautkan ulang."))
                } else {
                    pairingMenu()
                }
                break

            case "4":
                console.log(red("→ BOT DIMATIKAN"))
                process.exit(0)
                break

            case "5":
                console.log(red("\n→ Menghapus AUTH..."))
                fs.rmSync("./auth", { recursive: true, force: true })
                console.log(green("Auth dihapus. Restart bot untuk login ulang.\n"))
                break

            case "6":
                panel("Terhubung ✓", sock?.user?.id?.split(":")[0] || "-", "-", true)
                break

            default:
                console.log(yellow("Perintah tidak dikenal"))
        }
    })
}

// PAIRING MENU HYBRID
function pairingMenu() {
    console.log(`
Pilih metode tautkan perangkat:

1) QR CODE (scan di WhatsApp)
2) PAIRING CODE (memasukkan nomor dulu)

Ketik angka:   
`)
    rl.question("> ", async (x) => {
        if (x === "1") startBot("qr")
        else if (x === "2") askNumber()
        else console.log(red("Pilihan tidak valid"))
    })
}

function askNumber() {
    rl.question("\nMasukkan nomor WhatsApp (628xxxx): ", async (num) => {
        if (!num.startsWith("62")) return console.log(red("Nomor tidak valid"))
        global.pairNumber = num
        startBot("pair")
    })
}

// INTERNAL RESTART
function restartBot() {
    console.log(red("\n→ Restarting bot...\n"))
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    lastLog = "-"
    pairingInProgress = false

    delete require.cache[require.resolve("./axiom.js")]
    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")

    startBot()
}

// START BOT
async function startBot(mode = "normal") {
    try {
        if (global.sock) {
            try { global.sock.end?.() } catch {}
            try { global.sock.ws?.close?.() } catch {}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./auth")
        const { version } = await fetchLatestBaileysVersion()

        let config = {
            version,
            logger: Pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, Pino().info)
            }
        }

        if (mode === "pair") {
            config.mobile = ["android"]
        }

        const sock = makeWASocket(config)
        global.sock = sock
        setupMenu(sock)

        if (!sock.user) {
            panel("Menunggu Login...", "-")
        }

        // CONNECTION EVENTS
        sock.ev.on("connection.update", async (u) => {
            const { qr, connection, lastDisconnect, pairingCode } = u

            if (mode === "pair" && pairingCode) {
                console.clear()
                console.log(green("\nPAIRING CODE: "))
                console.log(green(pairingCode))
                return
            }

            if (qr && mode === "qr") {
                panel("Scan QR!", "-")
                qrcode.generate(qr, { small: true })
            }

            if (connection === "open") {
                pairingInProgress = false
                panel(green("Terhubung ✓"), sock.user.id.split(":")[0])
            }

            if (connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode

                if (code === 401) {
                    console.log(red("Session invalid! Menghapus auth..."))
                    fs.rmSync("./auth", { recursive: true, force: true })
                    return restartBot()
                }

                if (!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus, reconnect..."), "Reconnect")
                    setTimeout(() => startBot(), 2000)
                }
            }
        })

        sock.ev.on("creds.update", saveCreds)

        // MESSAGE
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0]
            if (!msg.message) return

            if (!msg.key.fromMe) msgCount++

            const from = msg.key.remoteJid
            const text = msg.message.conversation ||
                msg.message.extendedTextMessage?.text || ""

            lastLog = `${from} → ${text}`
            panel("Terhubung ✓", sock.user.id.split(":")[0])

            if (text === "ping") {
                let t = Date.now()
                await sock.sendMessage(from, { text: "pong!" })
                panel("Terhubung ✓", sock.user.id.split(":")[0], (Date.now() - t) + " ms")
            }
        })

        // ANTI CRASH
        process.on("uncaughtException", (err) => {
            errCount++
            lastLog = red("Error: " + err.message)
            panel(red("Error!"), "Running")
        })

        process.on("unhandledRejection", (err) => {
            errCount++
            lastLog = red("Reject: " + err)
            panel(red("Error!"), "Running")
        })

    } catch (e) {
        console.log(red("Fatal Error:"), e)
        setTimeout(startBot, 2000)
    }
}

startBot()