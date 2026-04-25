module.exports = {
  indent: "  ",
  semverGroups: [
    {
      range: "",
      dependencyTypes: ["prod", "dev"],
      dependencies: ["**"],
      packages: ["**"]
    }
  ],
  versionGroups: [
    {
      label: "Foundry Core Blocks",
      dependencies: ["@saas-maker/*"],
      packages: ["**"]
    },
    {
      label: "Standard React Ecosystem",
      dependencies: ["react", "react-dom", "next"],
      packages: ["**"]
    }
  ],
  sortAz: [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "scripts"
  ],
  sortFirst: ["name", "version", "private", "type", "scripts", "dependencies", "devDependencies"]
};
