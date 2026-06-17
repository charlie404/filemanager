// Dev launcher: picks free ports for the PHP reference server and Vite (so it
// never collides with another local server on 8000/3000), wires Vite's proxy to
// the chosen PHP port, and tears both down together on exit.
import { spawn } from 'node:child_process'
import net from 'node:net'

function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '0.0.0.0')
  })
}

async function findPort(start) {
  for (let p = start; p < start + 50; p++) {
    if (await isFree(p)) return p
  }
  throw new Error(`No free port near ${start}`)
}

const apiPort = await findPort(Number(process.env.FM_API_PORT) || 8000)
const vitePort = await findPort(Number(process.env.FM_PORT) || 3000)

console.log('\n  @charlie404/filemanager — dev')
console.log(`  app  (vite)  →  http://localhost:${vitePort}`)
console.log(`  api  (php)   →  http://localhost:${apiPort}\n`)

const env = { ...process.env, FM_API_PORT: String(apiPort), FM_PORT: String(vitePort) }
const opts = { stdio: 'inherit', env }

const php = spawn('php', ['-S', `0.0.0.0:${apiPort}`, 'server/router.php'], opts)
const vite = spawn('npx', ['vite', '--port', String(vitePort)], opts)

let exiting = false
function shutdown() {
  if (exiting) return
  exiting = true
  php.kill()
  vite.kill()
  process.exit()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
php.on('exit', shutdown)
vite.on('exit', shutdown)
