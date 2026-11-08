import { DIRECTORY_PROJECTS } from './directory';
import { buildSubmissionKits } from '../../../../scripts/submission-kits.mjs';

export const SUBMISSION_KITS = buildSubmissionKits(DIRECTORY_PROJECTS);
export const SUBMISSION_KIT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
};
