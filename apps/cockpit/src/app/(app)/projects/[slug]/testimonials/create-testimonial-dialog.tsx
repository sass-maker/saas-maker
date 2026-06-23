'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { apiFetchClient, getClientToken } from '@/lib/api-client';

interface Props {
  projectId: string;
}

export function CreateTestimonialDialog({ projectId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [authorTitle, setAuthorTitle] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState('5');
  const [tweetUrl, setTweetUrl] = useState('');

  function resetForm() {
    setAuthorName('');
    setAuthorEmail('');
    setAuthorTitle('');
    setContent('');
    setRating('5');
    setTweetUrl('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/testimonials/dashboard/${projectId}`, token, {
        method: 'POST',
        body: JSON.stringify({
          author_name: authorName.trim(),
          author_email: authorEmail.trim(),
          author_title: authorTitle.trim() || undefined,
          content: content.trim(),
          rating: parseInt(rating, 10),
          tweet_url: tweetUrl.trim() || undefined,
        }),
      });
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add testimonial');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Testimonial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Testimonial</DialogTitle>
            <DialogDescription>Manually add a testimonial from a customer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="author-name">Name *</Label>
                <Input
                  id="author-name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="author-email">Email *</Label>
                <Input
                  id="author-email"
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="author-title">Title</Label>
                <Input
                  id="author-title"
                  placeholder="CEO at Acme"
                  value={authorTitle}
                  onChange={(e) => setAuthorTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rating">Rating *</Label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger id="rating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {'★'.repeat(n)}
                        {'☆'.repeat(5 - n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tweet-url">Tweet URL</Label>
              <Input
                id="tweet-url"
                type="url"
                placeholder="https://twitter.com/..."
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !authorName.trim() || !authorEmail.trim() || !content.trim()}
            >
              {loading ? 'Adding...' : 'Add Testimonial'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
