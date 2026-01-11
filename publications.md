---
layout: page
title: Publications
custom_js: theme
---

{% assign publications = site.data.menu.entries | where: "id", "publications" | first %}
{{ publications.content }}
