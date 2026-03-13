---
layout: default
title: NORDEN II – Tactical Dossier
---

<div class="classified-header-container">
    <img src="{{ site.baseurl }}/assets/images/declassified-norden-header.png" alt="Norden II Declassified" class="classified-header-img">
</div>

# NORDEN II: TACTICAL DOSSIER
**AUTOMATED BOMBING COMPUTER & BALLISTICS DATABASE**

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
    <a href="{{ site.baseurl }}/aircraft/" style="color: #bf9b30; font-weight: bold;">[ACCESS ARCHIVE]</a>
  </div>
  
  <div class="data-card" style="flex: 1; border: 1px solid #444; padding: 20px; background-color: #1a1a1a;">
    <h3 style="color: #33ff33;">[02] WEAPONS & HELOS</h3>
    <p>Ballistics tables, missile guidance types (F&F, SACLOS), and helicopter ordnance.</p>
    <a href="{{ site.baseurl }}/weapons/" style="color: #bf9b30; font-weight: bold;">[ACCESS ARCHIVE]</a>
  </div>
</div>

---

> **NORDEN II SYSTEM NOTE:** > This tool provides automated calculation data to assist bombardiers in achieving maximum impact on target. Precision is the difference between a mission's success and a total loss.
