---
layout: default
title: Aircraft Archive
permalink: /aircraft.html
---

<div style="background: #001a00; border: 1px solid #00ff00; padding: 15px; margin-bottom: 20px;">
  <h2 style="color: #00ff00; margin: 0; font-family: monospace;">> EXECUTING DATA_RETRIEVAL: AIRCRAFT_MASTER_LIST</h2>
</div>

### INTELLIGENCE FEED
The following data is pulled directly from the **NORDEN II** database files.

<table style="width: 100%; border-collapse: collapse; font-family: monospace; color: #33ff33; background: #050505; border: 1px solid #004400;">
  <thead>
    <tr style="background: #004400; color: #ffffff;">
      <th style="padding: 10px; border: 1px solid #00ff00;">NAME</th>
      <th style="padding: 10px; border: 1px solid #00ff00;">RANK</th>
      <th style="padding: 10px; border: 1px solid #00ff00;">BR</th>
      <th style="padding: 10px; border: 1px solid #00ff00;">RADAR</th>
    </tr>
  </thead>
  <tbody>
    {% for plane in site.data.aircraft_list %}
    <tr>
      <td style="padding: 10px; border: 1px solid #004400;">{{ plane.name }}</td>
      <td style="padding: 10px; border: 1px solid #004400; text-align: center;">{{ plane.rank }}</td>
      <td style="padding: 10px; border: 1px solid #004400; text-align: center;">{{ plane.br }}</td>
      <td style="padding: 10px; border: 1px solid #004400;">{{ plane.radar_type }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>



---

<a href="{{ '/' | relative_url }}" style="color: #00ff00; text-decoration: none;">[ BACK TO COMMAND CENTER ]</a>
