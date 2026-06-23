# Orba Console

A browser control surface for the Artiphon Orba. Plug the Orba in over USB, or connect over
Bluetooth, and drive everything the official app used to: instruments and presets, per-part
mix (volume, reverb, delay), tempo, key and scale, quantize. Plus a built-in looper and a
piano-roll note editor.

## Use it

**Live:** https://holofermes.github.io/orba-console/

Open it in a Chromium browser.

## Screenshots

<p align="center">
  <img src="docs/loop.gif" width="300" alt="Orba Console looping a polymeter groove"><br>
  <sub><b>The looper, live.</b> Four tracks at different loop lengths (4, 8, 16, and 16 beats) play together as one polymeter groove, driven here from a phone.</sub>
</p>

<div align="center">
<table>
  <tr>
    <td width="33%" valign="top" align="center">
      <img src="docs/note-editor.png" width="190" alt="Piano-roll note editor"><br>
      <b>Note editor</b><br>
      <sub>Draw, move, and resize notes on a piano roll, with grid snap, box-select, undo, and a movable loop window.</sub>
    </td>
    <td width="33%" valign="top" align="center">
      <img src="docs/instrument.png" width="190" alt="Per-part instrument and FX"><br>
      <b>Instrument &amp; FX</b><br>
      <sub>Choose a preset for each part and set its volume, reverb, and delay, all kept in sync with the device.</sub>
    </td>
    <td width="33%" valign="top" align="center">
      <img src="docs/routing.png" width="190" alt="USB controllers routed per part"><br>
      <b>Controller routing</b><br>
      <sub>Point each USB MIDI controller at its own Orba part, and set the device's MIDI mode and pitch-bend range.</sub>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top" align="center">
      <img src="docs/key-scale.png" width="190" alt="Key and scale"><br>
      <b>Key &amp; scale</b><br>
      <sub>Set the Orba's root and scale.</sub>
    </td>
    <td width="33%" valign="top" align="center">
      <img src="docs/songs.png" width="190" alt="Song library"><br>
      <b>Songs &amp; presets</b><br>
      <sub>Load any of the factory songs, or save and recall your own snapshots.</sub>
    </td>
  </tr>
</table>
</div>

## What's inside

- Per-part instrument and preset switching, mix, tempo, key and scale, and quantize, with
  live two way device sync
- A browser looper that records external MIDI controllers into per track loops (the
  Orba's own looper only records the Orba itself), with polymeter and movable loop windows
- A piano-roll note editor with snap, marquee select, and undo
- An optional key-mapping layer for a hardware controller

## Built on

The protocol is its own project: [orba-protocol](https://github.com/holofermes/orba-protocol),
a spec plus reference libraries. The optional DOIO KB16 controller firmware is
[orba-doio](https://github.com/holofermes/orba-doio).
