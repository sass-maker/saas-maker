import getConfig from "./index.js";

export default [
  ...(await getConfig('vite')),
  {
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
];
