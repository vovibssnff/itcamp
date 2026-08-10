import { authHandlers } from './auth'
import { constructorHandlers } from './constructor'
import { scenarioHandlers } from './scenario'
import { orchestratorHandlers } from './orchestrator'
import { assessmentHandlers } from './assessment'
import { reportHandlers } from './report'
import { snapshotHandlers } from './snapshot'
import { aiHandlers } from './ai'
import { assignmentHandlers } from './assignments'

export const handlers = [
  ...authHandlers,
  ...constructorHandlers,
  ...scenarioHandlers,
  ...orchestratorHandlers,
  ...assessmentHandlers,
  ...reportHandlers,
  ...snapshotHandlers,
  ...aiHandlers,
  ...assignmentHandlers,
]
