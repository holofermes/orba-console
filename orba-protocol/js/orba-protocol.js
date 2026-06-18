// orba-protocol.js — reference implementation of the Artiphon Orba control protocol.
//
// Framework-free ES module: codec (8<->7 bit + CRC-16 + SysEx framing), BLE-MIDI
// packetization, and pure command builders. Verified byte-identical against captured
// traffic and a live Orba 2. See ../spec/SPEC.md for the protocol this implements.
//
// Layering:  buildCommand(payload)  ->  framed SysEx bytes  ->  bleWrapMidiPackets() for BLE
// Command builders return a `payload` array ([op, domain, addrHi, addrLo, ...value]);
// wrap it with buildCommand() to get the bytes to send.
//
// Not affiliated with or endorsed by Artiphon.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const POLY = 0xa001;          // CRC-16, reflected 0x8005
export const FRAME = [0x82, 0x01];   // comms signature v2

export const GET = 0x02;
export const SET = 0x03;

// Standard BLE-MIDI GATT UUIDs (the Orba exposes these; not device-specific).
export const BLE_MIDI_SERVICE_UUID = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
export const BLE_MIDI_CHARACTERISTIC_UUID = "7772e5db-3868-4112-a1a9-f2669d106bf3";

// Parts, in WIRE part-index order (the byte sent at domain 0x01 addr 0x0003).
export const PARTS = [
  { key: "lead",  name: "Lead",  index: 0, channel: 1  },
  { key: "chord", name: "Chord", index: 1, channel: 16 },
  { key: "bass",  name: "Bass",  index: 2, channel: 9  },
  { key: "drum",  name: "Drum",  index: 3, channel: 10 },
];

export const SELECT_ADDRS = { drum: 0x0026, bass: 0x0027, chord: 0x0028, lead: 0x0029, song: 0x002a };
export const NAME_ADDRS   = { song: 0x0015, lead: 0x0019, chord: 0x001a, bass: 0x001b, drum: 0x001c };

// Per-part mix FX: payload `03 02 50 <param> <val> 00 01 04`, param = base + offset, val 0-255.
export const FX_BASE   = [0x00, 0x08, 0x10, 0x18];        // by part index
export const FX_OFFSET = { volume: 0, pan: 1, reverb: 2, delay: 3 };

export const SCALES = [
  "Major", "Natural Minor", "Harmonic Minor", "Melodic Minor",
  "Major Pentatonic", "Minor Pentatonic", "Dorian", "Phrygian",
  "Lydian", "Mixolydian", "Locrian",
];
export const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const QUANTIZE = { off: 0, grid: 1, groove: 2 };
export const MIDI_MODE = { perPart: 0, mpe: 1, single: 2 };

// ---------------------------------------------------------------------------
// Codec  (see SPEC.md §2)
// ---------------------------------------------------------------------------

export function crc16(data) {
  let c = 0;
  for (const b of data) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c & 1) ? ((c >>> 1) ^ POLY) : (c >>> 1);
  }
  return c & 0xffff;
}

/** 8-bit packet -> 7-bit wire stream (LSB-first bit repack). */
export function encode7(packet) {
  const bits = [];
  for (const b of packet) for (let i = 0; i < 8; i++) bits.push((b >>> i) & 1);
  const wire = [];
  for (let i = 0; i < bits.length; i += 7) {
    let v = 0;
    for (let j = 0; j < 7 && i + j < bits.length; j++) v |= bits[i + j] << j;
    wire.push(v);
  }
  return wire;
}

/** 7-bit wire stream -> 8-bit packet. */
export function decode7(wire) {
  const bits = [];
  for (const b of wire) for (let i = 0; i < 7; i++) bits.push((b >>> i) & 1);
  const packet = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v |= bits[i + j] << j;
    packet.push(v);
  }
  return packet;
}

/**
 * Wrap a command payload in a full SysEx message (returns a byte array F0 .. F7).
 * `msgId` is echoed by the device in its reply; any value works when synthesizing.
 */
export function buildCommand(payload, msgId = 0) {
  const p = Array.from(payload);
  const packet = [...FRAME, msgId & 0xff, (p.length >>> 8) & 0xff, p.length & 0xff, ...p];
  const crc = crc16(packet);
  packet.push((crc >>> 8) & 0xff, crc & 0xff);
  return [0xf0, 0x00, ...encode7(packet), 0xf7];
}

/** Decode a captured/received SysEx message into { msgId, payload, crc, crcOk }. */
export function decodeMessage(bytes) {
  let wire = Array.from(bytes);
  if (wire[0] === 0xf0) wire = wire.slice(1);
  if (wire[wire.length - 1] === 0xf7) wire = wire.slice(0, -1);
  if (wire[0] === 0x00) wire = wire.slice(1);   // signature/version byte
  const packet = decode7(wire);
  if (packet.length < 7) return null;
  const crcMsg = (packet[packet.length - 2] << 8) | packet[packet.length - 1];
  const crcCalc = crc16(packet.slice(0, -2));
  return {
    msgId: packet[2],
    payload: packet.slice(5, -2),
    crc: crcMsg,
    crcOk: crcMsg === crcCalc,
  };
}

/** A simple incrementing message-id source (8-bit), seeded to match app captures. */
export function createMsgIdCounter(start = 0x60) {
  let id = start & 0xff;
  return () => { const v = id; id = (id + 1) & 0xff; return v; };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a name reply's bytes to a trimmed ASCII string (stops at the first NUL). */
export function ascii(bytes) {
  const end = Array.from(bytes).indexOf(0);
  const slice = Array.from(bytes).slice(0, end >= 0 ? end : bytes.length);
  return String.fromCharCode(...slice).replace(/[^\x20-\x7e]/g, ".").trim();
}

/** UTF-8 encode a preset/song filename, null-padded to `length` (129) bytes. */
export function filenameBytes(text, length = 129) {
  const enc = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(text)
    : Uint8Array.from(Array.from(String(text), c => c.charCodeAt(0) & 0xff));
  const bytes = Array.from(enc.slice(0, length - 1));
  while (bytes.length < length) bytes.push(0);
  return bytes;
}

export function partIndex(keyOrIndex) {
  if (typeof keyOrIndex === "number") return keyOrIndex & 0x03;
  const p = PARTS.find(p => p.key === keyOrIndex);
  return p ? p.index : 0;
}

// ---------------------------------------------------------------------------
// BLE-MIDI packetization  (see SPEC.md §3)
// ---------------------------------------------------------------------------

/** Split framed MIDI/SysEx bytes into BLE-MIDI packets (default 20-byte writes). */
export function bleWrapMidiPackets(midiBytes, writeSize = 20) {
  const midi = Array.from(midiBytes);
  if (!midi.length) return [];
  if (midi[0] !== 0xf0) return [[0x80, 0x80, ...midi]];   // non-SysEx: single packet
  const body = midi.slice(0, -1);                          // drop trailing 0xF7
  const packets = [];
  let i = 0, first = true;
  while (i < body.length) {
    if (first) {
      const chunk = body.slice(i, i + (writeSize - 2));
      packets.push([0x80, 0x80, ...chunk]);                // header + timestamp
      i += chunk.length; first = false;
    } else {
      const chunk = body.slice(i, i + (writeSize - 1));
      packets.push([0x80, ...chunk]);                      // header only, NO timestamp
      i += chunk.length;
    }
  }
  packets.push([0x80, 0x80, 0xf7]);                        // end packet
  return packets;
}

const _midiMsgLen = status => {
  const t = status & 0xf0;
  if (t === 0x80 || t === 0x90 || t === 0xa0 || t === 0xb0 || t === 0xe0) return 2;
  if (t === 0xc0 || t === 0xd0) return 1;
  if (status === 0xf2) return 2;
  if (status === 0xf1 || status === 0xf3) return 1;
  return 0;
};

/**
 * Stateful parser for incoming BLE-MIDI notifications. `feed(value)` returns an array of
 * complete MIDI messages (each a byte array); multi-packet SysEx is reassembled across calls.
 */
export function createBleMidiParser() {
  let sysex = null;
  return {
    /** Drop any partially-received SysEx (call on (re)connect to avoid a stale fragment). */
    reset() { sysex = null; },
    feed(value) {
      const data = Array.from(value);
      const out = [];
      let i = 1;                       // skip the leading BLE-MIDI header byte
      while (i < data.length) {
        const b = data[i];
        if (sysex) {
          if (b === 0xf7) { sysex.push(0xf7); out.push(sysex); sysex = null; i++; }
          else if (b & 0x80) { i++; }  // timestamp byte inside SysEx: skip
          else { sysex.push(b); i++; }
          continue;
        }
        if (b & 0x80) {                // timestamp precedes a status byte
          i++; if (i >= data.length) break;
          const status = data[i];
          if (status === 0xf0) { sysex = [0xf0]; i++; continue; }
          const len = _midiMsgLen(status);
          out.push(data.slice(i, i + 1 + len)); i += 1 + len;
        } else { i++; }
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Command builders  (return a payload array; wrap with buildCommand)
// ---------------------------------------------------------------------------

const u16 = addr => [(addr >>> 8) & 0xff, addr & 0xff];
const getCmd = (domain, addr) => [GET, domain, ...u16(addr)];
const setCmd = (domain, addr, ...val) => [SET, domain, ...u16(addr), ...val];

// Active part (SPEC §4.1)
export const getActivePart = () => getCmd(0x01, 0x0003);
export const setActivePart = part => setCmd(0x01, 0x0003, partIndex(part));

// Transport / looper (SPEC §4.2)
export const transport          = value => setCmd(0x07, 0x0002, value & 0xff);
export const recordOverdub      = () => transport(0x01);
export const eraseActiveLoop    = () => transport(0x02);
export const eraseSong          = () => transport(0x03);
export const play               = () => transport(0x05);
export const pause              = () => transport(0x06);
export const getTransportState  = () => getCmd(0x07, 0x0001);
export const getAnyEventsInLooper = () => getCmd(0x07, 0x0008);

// Per-part mix FX (SPEC §4.3). percent 0-100; kind = volume|reverb|delay|pan.
export function setFx(part, kind, percent) {
  const param = (FX_BASE[partIndex(part)] + FX_OFFSET[kind]) & 0x7f;
  const val = Math.max(0, Math.min(255, Math.round(percent / 100 * 255)));
  return setCmd(0x02, 0x5000 | param, val, 0x00, 0x01, 0x04);
}
export function getFx(part, kind) {
  const param = (FX_BASE[partIndex(part)] + FX_OFFSET[kind]) & 0x7f;
  return getCmd(0x02, 0x5000 | param);
}
/** Map a 0-255 FX reply value back to a 0-100 percent. */
export const fxValueToPercent = v => Math.round(v / 255 * 100);

// Instrument / preset selection (SPEC §4.4). Returns [selectCmd, commitCmd?].
export function selectPreset(kind, filename) {
  const addr = SELECT_ADDRS[kind];
  if (addr == null) throw new Error(`unknown select target: ${kind}`);
  const cmds = [setCmd(0x03, addr, ...filenameBytes(filename))];
  if (kind !== "song") cmds.push(setCmd(0x03, 0x0022, 0x00));   // commit
  return cmds;
}
export const getName = key => getCmd(0x03, NAME_ADDRS[key]);

// Tempo (SPEC §4.5). bpm float; 16-bit big-endian = round(bpm*100).
export function setTempo(bpm) {
  const v = Math.round(bpm * 100) & 0xffff;
  return setCmd(0x07, 0x0007, (v >>> 8) & 0xff, v & 0xff);
}
export const getTempo = () => getCmd(0x07, 0x0007);
/** Decode a tempo reply payload back to BPM. */
export const tempoToBpm = payload => ((payload[4] << 8) | payload[5]) / 100;

// Key / scale (SPEC §4.6)
export const setKey   = semitone => setCmd(0x03, 0x0012, semitone & 0xff);   // signed byte
export const getKey   = () => getCmd(0x03, 0x0012);
export const setScale = idx => setCmd(0x03, 0x0013, idx & 0xff);
export const getScale = () => getCmd(0x03, 0x0013);

// Quantize is PER-PART (SPEC §4.7). Register low byte = 3 + part index:
// Lead 0x03, Chord 0x04, Bass 0x05, Drum 0x06  (= 6 - internal ModeId). mode: 0 off/as-played,
// 1 grid (snap to 16th), 2 groove (snap to 16th + a 16th-note swing).
export const setQuantize = (part, mode) => setCmd(0x07, 0x0003 + partIndex(part), mode & 0xff);
export const getQuantize = part => getCmd(0x07, 0x0003 + partIndex(part));

// Metronome (SPEC §4.8) — enum to confirm by snoop
export const setMetronome = mode => setCmd(0x03, 0x0020, mode & 0xff);
export const getMetronome = () => getCmd(0x03, 0x0020);

// Misc single-byte registers (SPEC §4.10)
export const setMidiMode       = mode => setCmd(0x03, 0x000d, mode & 0xff);
export const getMidiMode       = () => getCmd(0x03, 0x000d);
export const setPitchBendRange = v => setCmd(0x03, 0x000e, v & 0xff);
export const getPitchBendRange = () => getCmd(0x03, 0x000e);
export const setHaptics        = on => setCmd(0x03, 0x001d, on ? 1 : 0);
export const getBatteryPercent = () => getCmd(0x03, 0x000f);
export const getMasterVolume   = () => getCmd(0x03, 0x0001);
export const getSpeakerEnable  = () => getCmd(0x03, 0x000c);
export const getLooperCrcs     = () => getCmd(0x03, 0x0014);

// Read the current selected preset/song filename for a target (drum|bass|chord|lead|song).
export const getSelectedFile = kind => getCmd(0x03, SELECT_ADDRS[kind]);

// Advanced key/scale (SPEC §4.6 side effects): write an 8-byte scale-interval map to one of
// the d03 interval addresses (0x08/0x09/0x0a), then commit with applyScale().
export const setScaleInterval = (addr, notes) => setCmd(0x03, addr, ...notes);
export const applyScale = () => setCmd(0x01, 0x000b, 0x01);

/** Convenience: parse a GET reply payload into { op, domain, addr, value:[...] }. */
export function parseReply(payload) {
  if (!payload || payload.length < 4) return null;
  return {
    op: payload[0],
    domain: payload[1],
    addr: (payload[2] << 8) | payload[3],
    value: payload.slice(4),
  };
}
