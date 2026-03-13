---
layout: default
title: Aircraft Archive
permalink: /aircraft.html
---

# AIRCRAFT INTELLIGENCE REPORT

layout: default
title: Aircraft Archive
---

# [01] AIRCRAFT ARCHIVE
**STATUS: DECLASSIFIED**

This archive contains technical specifications and reconnaissance imagery for World War II era aircraft. Data is synchronized directly from the `Aircraft-Pics` intelligence repository.

---

## ✈️ Operational Fleet

<div class="aircraft-list">
{% for image in site.data.aircraft_list.Aircraft_Pics %}
  <div class="aircraft-entry" style="border-bottom: 1px solid #333; padding: 20px 0;">
    <h3 style="color: #33ff33;">MODEL: {{ image | replace: ".png", "" | replace: "_", " " | uppercase }}</h3>
    
    <div style="display: flex; gap: 20px; align-items: start;">
      <img src="{{ site.data.repos.sources.game_pics }}{{ image }}" style="width: 300px; border: 1px solid #444;">
      
      <div class="specs">
        <p><strong>RECON_ID:</strong> WT-{{ forloop.index | plus: 1000 }}</p>
        <p><strong>NORDEN II COMPATIBLE:</strong> YES</p>
        <p><strong>PRIMARY ROLE:</strong> Strategic Bombing / Interception</p>
        <p style="color: #bf9b30;">[DATA ENCRYPTION ACTIVE - ADDITIONAL SPECS LOADING...]</p>
      </div>
    </div>
  </div>
{% endfor %}
</div>

[ <a href="{{ site.baseurl }}/">RETURN TO COMMAND CENTER</a> ]
