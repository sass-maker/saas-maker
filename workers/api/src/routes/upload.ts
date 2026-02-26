import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';

const upload = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

upload.post('/', requireApiKey, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return c.json({ error: 'No file provided' }, 400);
  if (!ALLOWED_TYPES.includes(file.type)) return c.json({ error: 'Invalid file type. Allowed: jpeg, png, gif, webp' }, 400);
  if (file.size > MAX_FILE_SIZE) return c.json({ error: 'File too large. Max 5MB' }, 400);

  const ext = file.type.split('/')[1];
  const key = `feedback/${crypto.randomUUID()}.${ext}`;

  await c.env.FEEDBACK_IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const imageUrl = `https://images.saasmaker.dev/${key}`;
  return c.json({ url: imageUrl }, 201);
});

export { upload };
