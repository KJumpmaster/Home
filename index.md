---
layout: default
title: NORDEN II – Tactical Dossier
---

<div style="background: #001100; border: 2px solid #00ff00; padding: 20px; text-align: center; font-family: monospace;">
  <h1 style="color: #00ff00; margin: 0; letter-spacing: 5px;">[ NORDEN II ]</h1>
  <p style="color: #00ff00; margin: 5px 0;">SYSTEM STATUS: ONLINE | DATABASE: 82ND-ABN-VET</p>
  <div style="border-top: 1px solid #00ff00; margin: 10px 0;"></div>
  <p style="color: #ff0000; font-weight: bold; margin: 0;">CLASSIFICATION: DECLASSIFIED</p>
</div>

# OPERATIONAL COMMAND
**WELCOME BACK, JUMPINGKJ.**

This dossier contains technical specifications and ballistics data for the NORDEN II project.

---

## 📡 Latest Reconnaissance
*Recent intelligence gathered for the database:*

<div class="recon-gallery">
  {% for image in site.data.aircraft_list.Aircraft_Pics limit:3 %}
  <div class="recon-item">
    <img src="{{ site.data.repos.sources.game_pics }}{{ image }}" alt="Recon Photo">
    <p>[RECON_ID: {{ image | truncate: 18 }}]</p>
  </div>
  {% endfor %}
</div>

---

## 📂 Operational Archives

<div class="data-grid" style="display: flex; gap: 20px; margin-top: 20px;">
  <div class="data-card" style="flex: 1; border: 1px solid #444; padding: 20px; background-color: #1a1a1a;">
    <h3 style="color: #33ff33;">[01] AIRCRAFT DATA</h3>
    <p>Performance specs, turn rates, and historical comparison for WWII heavy bombers.</p>
    <a href="{{ '/aircraft/' | relative_url }}" class="tactical-button">ACCESS ARCHIVE</a>
  
  <div class="data-card" style="flex: 1; border: 1px solid #444; padding: 20px; background-color: #1a1a1a;">
    <h3 style="color: #33ff33;">[02] WEAPONS & HELOS</h3>
    <p>Ballistics tables, missile guidance types (F&F, SACLOS), and helicopter ordnance.</p>
    <a href="{{ '/weapons' | relative_url }}" class="tactical-button">WEAPONS SYSTEMS</a>
  </div>
</div>

---

> **NORDEN II SYSTEM NOTE:** > This tool provides automated calculation data to assist bombardiers in achieving maximum impact on target. Precision is the difference between a mission's success and a total loss.
