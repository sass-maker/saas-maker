import type {
  DirectoryProject,
  ProductSubmission,
  SubmissionAsset,
} from '../apps/showcase/src/data/directory';

export interface SubmissionKit {
  $schema: 'fleet.product-submission-kit.v1';
  id: string;
  name: string;
  url: string;
  profileUrl: string;
  kitUrl: string;
  briefUrl: string;
  tagline: string | null;
  shortDescription: string;
  shortDescriptionOrigin: 'submission' | 'reviewed-directory-description';
  longDescription: string | null;
  categoryWords: string[];
  pricingModel: string | null;
  demoUrl: string | null;
  checkedAt: string | null;
  assets: (SubmissionAsset & { uploadSuitable: boolean; uploadLimit?: string })[];
  missing: string[];
  permissions: {
    createAccounts: false;
    publishListings: false;
    acceptReciprocalBadges: false;
    spendMoney: false;
  };
}
export function validatePublicSubmissionUrl(value: unknown, trail?: string): string;
export function validateSubmission(
  record: unknown,
  productId: string
): ProductSubmission | undefined;
export function submissionEligible(project: Partial<DirectoryProject>): boolean;
export function buildSubmissionKit(project: DirectoryProject): SubmissionKit | undefined;
export function buildSubmissionKits(projects: DirectoryProject[]): SubmissionKit[];
export function submissionBrief(kit: SubmissionKit): string;
