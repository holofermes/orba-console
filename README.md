# Orba Console

A browser control surface for the Artiphon Orba. Plug the Orba in over USB, or connect over
Bluetooth, and drive everything the official app used to: instruments and presets, per-part
mix (volume, reverb, delay), tempo, key and scale, quantize. Plus a built-in looper and a
piano-roll note editor.

## Use it

**Live:** https://holofermes.github.io/orba-console/

Open it in a Chromium browser.

## What's inside

- Per-part instrument and preset switching, mix, tempo, key and scale, and quantize, with
  live two-way device sync
- A browser looper that records external MIDI controllers into per-track loops (the
  Orba's own looper only records the Orba itself), with polymeter and movable loop windows
- A piano-roll note editor with snap, marquee select, and undo
- An optional key-mapping layer for a hardware controller

## Built on

The protocol is its own project: [orba-protocol](https://github.com/holofermes/orba-protocol),
a spec plus reference libraries. The optional DOIO KB16 controller firmware is
[orba-doio](https://github.com/holofermes/orba-doio).
