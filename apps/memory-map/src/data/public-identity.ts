export const publicIdentity = {
  name: "Memory Map",
  url: "https://chatgpt.significanthobbies.com",
  summary: "Turn a ChatGPT export ZIP into a private topic graph, searchable memory, repeated-question report, and fact history in your browser.",
  openapi: "https://chatgpt.significanthobbies.com/openapi.json",
  trainingAllowed: true,
  updatedAt: "2026-10-26",
  excludedPaths: ["/admin", "/auth", "/dashboard", "/api"],
};

export const publicPages = {
  "index": {
    "title": "Memory Map — Explore your ChatGPT history",
    "description": publicIdentity.summary,
    "path": "/"
  },
  "about": {
    "title": "What Memory Map finds in your ChatGPT history",
    "description": "See how Memory Map finds recurring questions, topic connections, memory changes, conversation strands, and private search in a ChatGPT export.",
    "path": "/about/"
  },
  "changelog": {
    "title": "Changelog · Memory Map",
    "description": "Meaningful improvements to Memory Map’s private ChatGPT-history analysis.",
    "path": "/changelog/"
  },
  "used-by": {
    "title": "Where Memory Map shows up",
    "description": "The Fleet surfaces that list, link, or monitor Memory Map — the browser-local ChatGPT export explorer.",
    "path": "/used-by/"
  }
};
