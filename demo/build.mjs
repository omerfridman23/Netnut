// Builds the narrated demo MP4:
//   1. Synthesizes each scene's narration with Windows SAPI (offline TTS).
//   2. Time-fits each clip to its scene slot (compress if too long, pad with silence).
//   3. Concatenates clips into one narration track.
//   4. Muxes the narration over the Playwright screen capture, offset by the recording pre-roll.
//
// Usage: node build.mjs [prerollMs]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REC = path.join(HERE, 'rec');
const TMP = path.join(HERE, 'tmp');
const OUT = path.join(HERE, 'meter-demo.mp4');
const PREROLL_MS = Number(process.argv[2] ?? 2566);
const TAIL_GAP = 0.45; // trailing silence per scene so lines don't run together

const ff = (args) => execFileSync(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
const probeDuration = (file) => {
  let out = '';
  try { ff(['-hide_banner', '-i', file]); } catch (e) { out = String(e.stderr || ''); }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error('cannot read duration of ' + file);
  return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
};

// --- locate newest recording ---
const webm = readdirSync(REC).filter((f) => f.endsWith('.webm')).sort();
if (!webm.length) throw new Error('no .webm recording found in ' + REC);
const VIDEO = path.join(REC, webm[webm.length - 1]);

// --- reset tmp ---
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const { voice, rate, scenes } = JSON.parse(readFileSync(path.join(HERE, 'narration.json'), 'utf8'));

// --- per scene: synth -> time-fit -> fixed-length clip ---
const fittedList = [];
for (const s of scenes) {
  const txtFile = path.join(TMP, `${s.id}.txt`);
  const rawWav = path.join(TMP, `raw_${s.id}.wav`);
  const fitWav = path.join(TMP, `fit_${s.id}.wav`);
  writeFileSync(txtFile, s.text, 'utf8');

  const ps = [
    'Add-Type -AssemblyName System.Speech;',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    `try { $s.SelectVoice('${voice}') } catch {};`,
    `$s.Rate = ${rate};`,
    `$s.SetOutputToWaveFile('${rawWav.replace(/\\/g, '\\\\')}');`,
    `$t = Get-Content -Raw -LiteralPath '${txtFile.replace(/\\/g, '\\\\')}';`,
    '$s.Speak($t); $s.Dispose();',
  ].join(' ');
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });

  const dur = probeDuration(rawWav);
  const target = Math.max(1.0, s.seconds - TAIL_GAP);
  let tempo = dur / target;
  if (tempo < 1.0) tempo = 1.0; // never slow speech down, only pad with silence

  // atempo only supports 0.5..2.0 per filter; chain if needed
  const tempoChain = [];
  let remaining = tempo;
  while (remaining > 2.0) { tempoChain.push('atempo=2.0'); remaining /= 2.0; }
  tempoChain.push(`atempo=${remaining.toFixed(4)}`);
  const af = `${tempoChain.join(',')},apad`;

  ff(['-y', '-i', rawWav, '-af', af, '-t', String(s.seconds), '-ar', '44100', '-ac', '2', fitWav]);
  fittedList.push(fitWav);
  console.log(`scene ${s.id.padEnd(13)} speech ${dur.toFixed(1)}s -> slot ${s.seconds}s (tempo ${tempo.toFixed(2)})`);
}

// --- concat narration ---
const listFile = path.join(TMP, 'list.txt');
writeFileSync(listFile, fittedList.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
const narration = path.join(TMP, 'narration.wav');
ff(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', narration]);

// --- mux: narration delayed by the recording pre-roll, over the video ---
const delay = Math.round(PREROLL_MS);
ff([
  '-y',
  '-i', VIDEO,
  '-i', narration,
  '-filter_complex', `[1:a]adelay=${delay}|${delay}[a]`,
  '-map', '0:v:0',
  '-map', '[a]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '23',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '160k',
  '-movflags', '+faststart',
  OUT,
]);

console.log('\nWrote', OUT);
