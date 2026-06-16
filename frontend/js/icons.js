const icons = {
  logo: '<svg viewBox="0 0 24 24"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z"/><path d="M8 15c2 1.4 5.8 1.4 8 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  'map-pin': '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 13h6v7H4zM14 4h6v16h-6zM4 4h6v5H4z"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>',
  sensor: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M21 20v-2a3.5 3.5 0 0 0-3-3.45M16 3.2a4 4 0 0 1 0 7.6"/></svg>',
  'user-plus': '<svg viewBox="0 0 24 24"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg>',
  shelter: '<svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  audit: '<svg viewBox="0 0 24 24"><path d="M8 3h8l3 3v15H5V3h3Z"/><path d="M15 3v4h4M8 12h8M8 16h8M8 8h3"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5v16h-5"/></svg>',
  login: '<svg viewBox="0 0 24 24"><path d="M14 17l5-5-5-5M19 12H7"/><path d="M10 4H5v16h5"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5.3 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/></svg>',
  emergency: '<svg viewBox="0 0 24 24"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z"/></svg>',
  donation: '<svg viewBox="0 0 24 24"><path d="M3 9h18v11H3z"/><path d="M12 9v11M3 13h18"/><path d="M8.5 9C6 9 5 7.8 5 6.5S6 4 7.4 4C9 4 10 6 12 9c2-3 3-5 4.6-5C18 4 19 5.2 19 6.5S18 9 15.5 9"/></svg>',
  broadcast: '<svg viewBox="0 0 24 24"><path d="M12 12h.01"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>',
  activity: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  'check-circle': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
};

export function icon(name) {
  return `<span class="icon" aria-hidden="true">${icons[name] || icons.logo}</span>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(node => {
    node.outerHTML = icon(node.dataset.icon);
  });
}
