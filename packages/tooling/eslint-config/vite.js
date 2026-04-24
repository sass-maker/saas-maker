import base from "./index.js";

export default [
  ...base,
  {
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
];
