// Stop the Conan II server (kills process on port 3000)
const { execSync } = require('child_process');
const PORT = 3000;

try {
  let killed = false;

  if (process.platform === 'win32') {
    const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
    const pids = [...new Set(
      out.split('\n')
        .map(l => l.trim().split(/\s+/).pop())
        .filter(p => /^\d+$/.test(p) && p !== '0')
    )];
    pids.forEach(pid => {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); killed = true; }
      catch(_) {}
    });
  } else {
    // macOS / Linux
    const out = execSync(`lsof -ti :${PORT}`, { encoding: 'utf8' });
    const pids = out.trim().split('\n').filter(Boolean);
    pids.forEach(pid => {
      try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); killed = true; }
      catch(_) {}
    });
  }

  if (killed) {
    console.log(`  ✓  Server on port ${PORT} stopped.`);
  } else {
    console.log(`  —  No server found on port ${PORT}.`);
  }
} catch(e) {
  console.log(`  —  No server found on port ${PORT}.`);
}
