# Catalog field mapping

This is documentation of the reversible mapping, not project data. All values are unchanged.

| Previous project field | Schema 2 project field |
| --- | --- |
| `id` | `id` |
| `name` | `name` |
| `category` | `classification.category` |
| `portfolio.futureForm` | `classification.futureForm` |
| `portfolio.kind` | `classification.kind` |
| `family` | `classification.family` |
| `tier` | `classification.tier` |
| `attention` | `classification.attention` |
| `personalUse` | `purpose.personalUse` |
| `moneyOrPersonalBrand` | `purpose.moneyOrPersonalBrand` |
| `unmetNeed` | `purpose.unmetNeed` |
| `audience` | `purpose.audience` |
| `lifecycle.status` | `lifecycle.status` |
| `lifecycle.resumeCondition` | `lifecycle.resumeCondition` |
| `portfolio.status` | `lifecycle.portfolioStatus` |
| `portfolio.priority` | `lifecycle.priority` |
| `portfolio.scopeDecision` | `lifecycle.scopeDecision` |
| `lifecycle.shareable` | `sharing.shareable` |
| `portfolio.readyToBeShared` | `sharing.readyToBeShared` |
| `portfolio.sharingReadiness` | `sharing.evidence` |
| `notes` | `ownerNotes.notes` |
| `ownerNarrative` | `ownerNotes.ownerNarrative` |
| `repo` | `repositories.localPath` |
| `sourcePath` | `repositories.sourcePath` |
| `repositoryUrl` | `repositories.url` |
| `repositoryAliases` | `repositories.aliases` |
| `repositoryVisibility` | `repositories.visibility` |
| `aliases` | `repositories.projectAliases` |
| `status` | `deployment.status` |
| `portfolio.deployed` | `deployment.deployed` |
| `authModel` | `deployment.authModel` |
| `deployKind` | `deployment.kind` |
| `cfProject` | `deployment.cfProject` |
| `cfPages` | `deployment.cfPages` |
| `deployTargets` | `deployment.targets` |
| `domains` | `deployment.domains` |
| `domainProbePaths` | `deployment.domainProbePaths` |
| `app` | `deployment.app` |
| `publicDir` | `deployment.publicDir` |
| `inRegistry` | `deployment.inRegistry` |
| `d1Databases` | `deployment.d1Databases` |
| `tursoDatabases` | `deployment.tursoDatabases` |
| `databaseResources` | `deployment.databaseResources` |
| `metrics` | `deployment.metrics` |
| `public` | `presentation.public` |

`publicDirectory.projects[id]` moves to `projects[id].presentation.directory`.
Unknown project fields stay under `retainedFields` and are restored by the adapter.
Unknown top-level fields, infrastructure and repository review records remain intact.
