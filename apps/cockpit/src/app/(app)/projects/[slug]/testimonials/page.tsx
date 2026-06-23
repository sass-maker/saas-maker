import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import { TestimonialActions } from './testimonial-actions';
import { CreateTestimonialDialog } from './create-testimonial-dialog';
import { Star, Clock, Check, BarChart3 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getAuthenticatedProject } from '../get-project';
import type { TestimonialRecord, TestimonialStatus } from '@saas-maker/contracts';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

const statusBadge: Record<
  TestimonialStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

export default async function TestimonialsPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let testimonials: TestimonialRecord[] = [];
  let total = 0;
  let stats = { total: 0, pending: 0, approved: 0, avg_rating: 0 };

  try {
    const res = await apiFetch(`/v1/testimonials/all?project_id=${project.id}`, {}, token);
    testimonials = res.data ?? [];
    total = res.total ?? 0;
    stats = res.stats ?? stats;
  } catch {
    // Fetch failed
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testimonials"
        description={`${total} total testimonial${total !== 1 ? 's' : ''}`}
        action={<CreateTestimonialDialog projectId={project.id} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={Star} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} />
        <StatCard title="Approved" value={stats.approved} icon={Check} />
        <StatCard
          title="Avg Rating"
          value={stats.avg_rating ? stats.avg_rating.toFixed(1) : '—'}
          icon={BarChart3}
        />
      </div>

      {testimonials.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {testimonials.map((t) => {
                const badge = statusBadge[t.status];
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.author_name}</div>
                      <div className="text-xs text-muted-foreground">{t.author_email}</div>
                      {t.author_title && (
                        <div className="text-xs text-muted-foreground">{t.author_title}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">{t.content}</p>
                      {t.tweet_url && (
                        <a
                          href={t.tweet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View tweet
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <StarRating rating={t.rating} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <TestimonialActions
                        testimonialId={t.id}
                        projectId={project.id}
                        currentStatus={t.status}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Star}
          title="No testimonials yet"
          description="Embed the testimonial form widget to start collecting social proof from your users."
        />
      )}
    </div>
  );
}
