import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync, openSync } from 'fs';
import path from 'path';

const PID_FILE     = path.join(process.cwd(), '..', 'backend', 'trading-agents', 'orchestrator.pid');
const ORCHESTRATOR = path.join(process.cwd(), '..', 'backend', 'trading-agents', 'orchestrator.js');
const LOG_FILE     = path.join(process.cwd(), '..', 'backend', 'trading-agents', 'orchestrator.log');

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(): number | null {
  try {
    if (!existsSync(PID_FILE)) return null;
    const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim());
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

export async function GET() {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    if (pid) try { unlinkSync(PID_FILE); } catch {}
    return NextResponse.json({ running: false });
  }
  return NextResponse.json({ running: true, pid });
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (action === 'start') {
      const pid = readPid();
      if (pid && isRunning(pid)) {
        return NextResponse.json({ running: true, pid, already: true });
      }
      if (pid) try { unlinkSync(PID_FILE); } catch {}

      const logFd = openSync(LOG_FILE, 'a');
      const child = spawn(process.execPath, [ORCHESTRATOR], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
      });
      child.unref();

      if (!child.pid) {
        return NextResponse.json({ running: false, error: 'Failed to spawn process' }, { status: 500 });
      }

      writeFileSync(PID_FILE, String(child.pid));
      return NextResponse.json({ running: true, pid: child.pid });
    }

    if (action === 'stop') {
      const pid = readPid();
      if (!pid) return NextResponse.json({ running: false });
      try { process.kill(pid, 'SIGTERM'); } catch {}
      try { unlinkSync(PID_FILE); } catch {}
      return NextResponse.json({ running: false });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ running: false, error: msg }, { status: 500 });
  }
}
