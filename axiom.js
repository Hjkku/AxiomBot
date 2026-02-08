// axiom.js
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const Pino = require("pino")
const readline = require("readline")
const fs = require("fs")

// IMPORT COMMAND HANDLER
const commandHandler = require("./database/command")

// GLOBAL STATE
let startTime = Date.now()
let msgCount = 0
let errCount = 0
let lastCPU = 0
let reconnecting = false
let logs = [] // 4 log terakhir
global.axiom = null
globalDevice = null
global.lastQR = null

// CPU USAGE LIGHT
let lastCPUTime = process.cpuUsage()
setInterval(() => {
    const now = process.cpuUsage()
    lastCPU = ((now.user - lastCPUTime.user + now.system - lastCPUTime.system)/1000).toFixed(1)
    lastCPUTime = now
}, 1000)

// PANEL HELPERS
function formatUptime(ms) {
    let s = Math.floor(ms/1000)
    let m = Math.floor(s/60)
    let h = Math.floor(m/60)
    s %= 60; m %= 60
    return `${h}h ${m}m ${s}s`
}
function getRam() { return (process.memoryUsage().rss/1024/1024).toFixed(1) + " MB" }
function green(t) { return `\x1b[32m${t}\x1b[0m` }
function red(t) { return `\x1b[31m${t}\x1b[0m` }
function yellow(t){ return `\x1b[33m${t}\x1b[0m` }

// PANEL
function panel(status, device, ping="-", showSource=false) {
    console.clear()
    console.log(`
┌─────────────────────────────────────────────┐
│          ${green("WHATSAPP BOT PANEL ULTRA")}        │
├─────────────────────────────────────────────┤
│ Status : ${status}
│ Device : ${device || "-"}
│ Uptime : ${formatUptime(Date.now()-startTime)}
│ CPU    : ${lastCPU} ms
│ RAM    : ${getRam()}
│ Ping   : ${ping}
│ Msg In : ${msgCount}
│ Errors : ${errCount}
├─────────────────────────────────────────────┤
│ Menu Interaktif:
│ 1) Restart Bot
│ 2) Refresh/Clear Panel
│ 3) Tautkan Perangkat (QR / Pairing)
│ 4) Keluar/Log out
│ 5) About / Source
├─────────────────────────────────────────────┤
│ 4 Log Terakhir:
│ ${logs.slice(-4).map(l=>yellow(l)).join("\n│ ")}
${showSource ? `
├─────────────────────────────────────────────┤
│ ${green("Source & Credits")}
│ Author       : Rangga
│ Script Writer: ChatGPT
│ Designer     : Rangga & ChatGPT
│ Versi Bot    : Ultra Low RAM v2.0
` : ""}
└─────────────────────────────────────────────┘
`)
}

// TERMINAL MENU
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function addLog(msg) {
    logs.push(msg)
    if(logs.length > 20) logs.shift()
}

function setupMenu(axiom) {
    rl.removeAllListeners("line")
    rl.on("line", async (input) => {
        switch(input.trim()) {
            case "1":
                console.log(red("\n→ Restarting bot...\n"))
                restartBot()
                break
            case "2":
                panel("Terhubung ✓", globalDevice)
                break
            case "3":
                if(globalDevice) {
                    console.log(red(`Device ${globalDevice} masih tersambung. Tidak bisa buat tautan baru.`))
                    break
                }
                console.log(green("Pilih metode: 1) QR  2) Pairing Code"))
                rl.question("Metode (1/2): ", async (method) => {
                    if(method.trim() === "1") {
                        if(global.lastQR) {
                            console.log(green("Scan QR sekarang:"))
                            qrcode.generate(global.lastQR, { small: true })
                        } else console.log(red("Tidak ada QR tersedia."))
                    } else if(method.trim() === "2") {
                        rl.question("Masukkan nomor tujuan (contoh 628xxxx): ", async (number) => {
                            try {
                                const jid = number.includes("@") ? number : number + "@s.whatsapp.net"
                                const code = await axiom.requestPairingCode(jid)
                                console.log(green(`Pairing code untuk ${number}: ${code}`))
                            } catch(e) {
                                console.log(red("Gagal request pairing code:", e.message))
                            }
                        })
                    } else console.log(yellow("Metode tidak valid."))
                })
                break
            case "4":
                console.log(red("→ Keluar bot"))
                process.exit(0)
                break
            case "5":
                panel("Terhubung ✓", globalDevice, "-", true)
                break
            default:
                console.log(yellow("Perintah tidak dikenal."))
        }
    })
}

// INTERNAL RESTART
function restartBot() {
    startTime = Date.now()
    msgCount = 0
    errCount = 0
    logs = []
    reconnecting = false

    delete require.cache[require.resolve("./axiom.js")]

    process.removeAllListeners("uncaughtException")
    process.removeAllListeners("unhandledRejection")

    startBot()
}

// START BOT
async function startBot() {
    try {
        if(global.axiom) {
            try{ global.axiom.end?.() } catch{}
            try{ global.axiom.ws?.close?.() } catch{}
        }

        const { state, saveCreds } = await useMultiFileAuthState("./axiomSesi")
        const { version } = await fetchLatestBaileysVersion()

        const axiom = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: "silent" })
        })
        global.axiom = axiom

        setupMenu(axiom)
        panel("Menunggu QR / Pairing...", "-")

        // CONNECTION UPDATE
        axiom.ev.on("connection.update", async (update) => {
            const { qr, connection, lastDisconnect } = update

            if(qr) global.lastQR = qr

            if(connection === "open") {
                reconnecting = false
                globalDevice = axiom.user.id.split(":")[0]
                addLog(`Terhubung ke device ${globalDevice}`)
                panel(green("Terhubung ✓"), globalDevice)
            }

            if(connection === "close") {
                const code = lastDisconnect?.error?.output?.statusCode
                addLog(`Terputus: ${code || "Unknown reason"}`)
                globalDevice = null

                if(!reconnecting) {
                    reconnecting = true
                    panel(red("Terputus, reconnect..."), "-")
                    setTimeout(() => startBot(), 2500)
                }
            }
        })

        axiom.ev.on("creds.update", saveCreds)

        // PESAN MASUK → COMMAND HANDLER
        axiom.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0]
            if(!msg.message) return

            if(!msg.key.fromMe) msgCount++

            const from = msg.key.remoteJid
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
            addLog(`${from} → ${text}`)
            panel("Terhubung ✓", globalDevice)

            try{
                await commandHandler(axiom, msg, from, text)
            } catch(e){
                errCount++
                addLog(`Error Command.js / Function.js: ${e.message}`)
            }
        })

        // ANTI CRASH
        process.on("uncaughtException", (err) => {
            errCount++
            addLog(`Error: ${err.message}`)
            panel(red("Error!"), globalDevice)
        })
        process.on("unhandledRejection", (err) => {
            errCount++
            addLog(`Reject: ${err}`)
            panel(red("Error!"), globalDevice)
        })

    } catch(e) {
        console.log(red("Startup Error:"), e)
        setTimeout(startBot, 2000)
    }
}

startBot()