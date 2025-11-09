/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Creates a circular SVG avatar with initials for a host.
 */
const createHostAvatar = (name: string, color: string): string => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="50" fill="${color}" />
    <text x="50" y="55" font-family="Arial, sans-serif" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;
  // Use encodeURIComponent to make the SVG safe for a data URL
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Creates a rectangular SVG with a gradient and text for a virtual set.
 */
const createVirtualSet = (text: string, color1: string, color2: string): string => {
  // Use a unique ID for the gradient to avoid conflicts if multiple SVGs are on the page
  const gradientId = `grad-${text.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#${gradientId})" />
    <text x="160" y="90" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle" style="paint-order: stroke; stroke: #000; stroke-width: 1px; stroke-linejoin: round;">${text}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// --- HOST AVATARS ---
export const HOST_JAMSHID_IMG = createHostAvatar('Jamshid', '#ff4600');
export const HOST_FARAVAA_IMG = createHostAvatar('Faravaa', '#0d9c53');
export const HOST_JOE_ROGAN_IMG = createHostAvatar('Joe Rogan', '#800000');
export const HOST_KARA_SWISHER_IMG = createHostAvatar('Kara Swisher', '#333333');
export const HOST_BRENE_BROWN_IMG = createHostAvatar('Brené Brown', '#c71585');
export const HOST_IRA_GLASS_IMG = createHostAvatar('Ira Glass', '#4682b4');
export const HOST_BEN_SHAPIRO_IMG = createHostAvatar('Ben Shapiro', '#00008b');
export const HOST_MARC_MARON_IMG = createHostAvatar('Marc Maron', '#556b2f');
export const HOST_DAVE_RAMSEY_IMG = createHostAvatar('Dave Ramsey', '#006400');
export const HOST_ANDREW_HUBERMAN_IMG = createHostAvatar('Andrew Huberman', '#1e90ff');
export const HOST_ALEX_COOPER_IMG = createHostAvatar('Alex Cooper', '#ff69b4');
export const HOST_GUY_RAZ_IMG = createHostAvatar('Guy Raz', '#20b2aa');

// --- VIRTUAL SETS ---
export const SET_ROGAN_IMG = createVirtualSet('Joe Rogan Inspired', '#5c4033', '#2e2019');
export const SET_EASTERN_IMG = createVirtualSet('Old Eastern Style', '#8b4513', '#d2691e');
export const SET_FUTURISTIC_IMG = createVirtualSet('Futuristic', '#0000ff', '#8a2be2');
export const SET_JAPANESE_IMG = createVirtualSet('Japanese Old Style', '#6b8e23', '#b8860b');
export const SET_AMATEUR_IMG = createVirtualSet('Amateur Setup', '#708090', '#2f4f4f');
