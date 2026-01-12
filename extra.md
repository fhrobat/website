---
layout: page
title: Extra activities and awards
custom_js: theme
---

{% assign extra = site.data.menu.entries | find: "id", "extra" %}
{% if extra and extra.content %}
  {{ extra.content }}
{% else %}
  <!-- Nessun contenuto per publications -->
{% endif %}
