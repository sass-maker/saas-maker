import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const tasksPage = readFileSync('apps/cockpit/src/app/(app)/tasks/page.tsx', 'utf8');
const taskBoard = readFileSync('apps/cockpit/src/components/tasks/TaskBoard.tsx', 'utf8');

describe('Cockpit tasks production data boundary', () => {
  it('loads production task-board data from the dashboard D1 binding, not api.sassmaker.com', () => {
    expect(tasksPage).toContain('listCockpitTasks()');
    expect(tasksPage).toContain('listCockpitProjectSlugs()');
    expect(tasksPage).toContain('listCockpitRuns(200)');
    expect(tasksPage).toContain('getCockpitSymphonyMemory');
  });

  it('routes production task-board mutations through same-origin cockpit endpoints', () => {
    expect(taskBoard).toContain("path.replace(/^\\/v1/, '/api/cockpit')");
    expect(taskBoard).toContain('taskBoardFetch');
  });

  it('mirrors cockpit-auth users before production task and memory writes', () => {
    const createRoute = readFileSync('apps/cockpit/src/app/api/cockpit/tasks/route.ts', 'utf8');
    const memoryRoute = readFileSync('apps/cockpit/src/app/api/cockpit/symphony/memory/route.ts', 'utf8');
    expect(createRoute).toContain('ensureCockpitUser');
    expect(createRoute).toContain('getDefaultCockpitOwnerId');
    expect(memoryRoute).toContain('ensureCockpitUser');
    expect(memoryRoute).toContain('getDefaultCockpitOwnerId');
  });
});
