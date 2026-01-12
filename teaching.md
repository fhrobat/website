---
layout: page
title: Teaching
custom_js: theme
---

{% assign teaching = site.data.menu.entries | where: "id", "teaching" | first %}
{{ teaching.content }}
