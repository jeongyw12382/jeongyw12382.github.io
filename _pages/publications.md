---
layout: page
permalink: /publications/
title: Publications
description: 
years: [2026, 2025, 2024, 2023, 2022, 2021]
nav: true
nav_order: 1
---
<!-- _pages/publications.md -->
<div class="publications">

<div class="paper-filters" role="group" aria-label="Filter papers by category">
  <button type="button" class="filter-chip" data-filter="all" aria-pressed="true">All <span class="chip-count">({% bibliography_count -f papers %})</span></button>
  {%- for c in site.data.paper_categories %}
  <button type="button" class="filter-chip" data-filter="{{ c.id }}" aria-pressed="false">{{ c.label | escape }} <span class="chip-count">({% bibliography_count -f papers -q @*[category={{ c.id }}]* %})</span></button>
  {%- endfor %}
</div>
<p class="paper-filter-status sr-only" aria-live="polite"></p>

{%- for y in page.years %}
<section class="pub-year" data-year="{{ y }}">
  <h2 class="year">{{y}}</h2>
  {%- if y == 2026 %}{% include locked_cards.html %}{% endif %}
  {% bibliography -f papers -q @*[year={{y}}]* %}
</section>
{% endfor %}

</div>
