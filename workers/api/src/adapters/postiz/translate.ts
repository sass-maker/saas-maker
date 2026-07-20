import type { DistributionRequest } from '../../../../../internal/contracts/distribution';
import { validateDistributionRequest } from '../../../../../internal/contracts/distribution';
import { PostizError } from './errors';
import type {
  PostizCreatePayload,
  PostizInstagramSettings,
  PostizMediaReference,
  PostizYoutubeSettings,
} from './types';

export function translateDistributionRequest(
  request: DistributionRequest,
  media: PostizMediaReference[],
  options: { instagramProvider?: 'instagram' | 'instagram-standalone' } = {}
): PostizCreatePayload {
  const validation = validateDistributionRequest(request);
  if (!validation.ok) {
    throw validationError(`Invalid distribution request: ${validation.issues.join('; ')}`);
  }
  if (request.assets.length !== 1 || !request.assets[0]?.media_type.startsWith('video/')) {
    throw validationError('Instagram Reels and YouTube Shorts require exactly one video asset');
  }
  const asset = request.assets[0];
  const providerMedia = media.find((entry) => entry.artifact_asset_id === asset.artifact_asset_id);
  if (!providerMedia?.id || !isHttpUrl(providerMedia.path)) {
    throw validationError('A matching uploaded Postiz media id and HTTP(S) path are required');
  }

  const settings =
    request.channel === 'instagram_reels'
      ? instagramSettings(options.instagramProvider ?? 'instagram')
      : youtubeSettings(request);

  return {
    type: request.intent,
    date: request.scheduled_for ?? request.requested_at,
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: request.integration_id },
        value: [
          {
            content: request.content.caption,
            image: [{ id: providerMedia.id, path: providerMedia.path }],
          },
        ],
        settings,
      },
    ],
  };
}

function instagramSettings(
  provider: 'instagram' | 'instagram-standalone'
): PostizInstagramSettings {
  return {
    __type: provider,
    post_type: 'reel',
    is_trial_reel: false,
    collaborators: [],
  };
}

function youtubeSettings(request: DistributionRequest): PostizYoutubeSettings {
  const title = request.content.title.trim();
  if (title.length < 2 || title.length > 100) {
    throw validationError('YouTube title must contain between 2 and 100 characters');
  }
  return {
    __type: 'youtube',
    title,
    type: request.intent === 'draft' ? 'private' : request.audience,
    selfDeclaredMadeForKids: 'no',
    thumbnail: null,
    tags: request.content.tags.map((tag) => ({ value: tag, label: tag })),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validationError(message: string): PostizError {
  return new PostizError({ category: 'validation', code: 'POSTIZ_TRANSLATION', message });
}
