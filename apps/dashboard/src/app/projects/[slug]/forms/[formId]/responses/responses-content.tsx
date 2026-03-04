"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ResponseActions } from "./response-actions";
import { ClipboardList, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type {
  FormQuestionRecord,
  FormResponseRecord,
  FormAnswerRecord,
  FormAnalyticsQuestion,
  FormQuestionType,
} from "@saas-maker/shared-types";

// --- Types ---

interface ResponseWithAnswers extends FormResponseRecord {
  answers: FormAnswerRecord[];
}

interface ResponsesContentProps {
  projectId: string;
  formId: string;
  questions: FormQuestionRecord[];
  responses: ResponseWithAnswers[];
  totalResponses: number;
  analytics: {
    total_responses: number;
    questions: FormAnalyticsQuestion[];
  } | null;
  page: number;
  limit: number;
  slug: string;
}

// --- Helpers ---

const CHOICE_TYPES: FormQuestionType[] = [
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "yes_no",
];

const NUMERIC_TYPES: FormQuestionType[] = [
  "rating",
  "nps",
  "opinion_scale",
  "number",
];

function isChoiceType(type: FormQuestionType) {
  return CHOICE_TYPES.includes(type);
}

function isNumericType(type: FormQuestionType) {
  return NUMERIC_TYPES.includes(type);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// --- Sub-components ---

function ChoiceSummaryCard({ q }: { q: FormAnalyticsQuestion }) {
  const distribution = (q.summary?.distribution ?? {}) as Record<
    string,
    number
  >;
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {q.total_answers} answer{q.total_answers !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No data yet</p>
        )}
        {entries.map(([label, count]) => {
          const pct =
            q.total_answers > 0
              ? Math.round((count / q.total_answers) * 100)
              : 0;
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate mr-2">{label}</span>
                <span className="text-muted-foreground shrink-0">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NumericSummaryCard({ q }: { q: FormAnalyticsQuestion }) {
  const avg = (q.summary?.average as number) ?? null;
  const min = (q.summary?.min as number) ?? null;
  const max = (q.summary?.max as number) ?? null;
  const distribution = (q.summary?.distribution ?? {}) as Record<
    string,
    number
  >;
  const entries = Object.entries(distribution).sort(
    ([a], [b]) => Number(a) - Number(b)
  );
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {q.total_answers} answer{q.total_answers !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-4 mb-4">
          <div>
            <div className="text-3xl font-bold">
              {avg !== null ? avg.toFixed(1) : "--"}
            </div>
            <div className="text-xs text-muted-foreground">Average</div>
          </div>
          {min !== null && max !== null && (
            <div className="text-sm text-muted-foreground">
              Range: {min} - {max}
            </div>
          )}
        </div>
        {entries.length > 0 && (
          <div className="flex items-end gap-1 h-16">
            {entries.map(([val, count]) => (
              <div key={val} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary rounded-sm min-h-[2px] transition-all"
                  style={{ height: `${(count / maxCount) * 100}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{val}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TextSummaryCard({ q }: { q: FormAnalyticsQuestion }) {
  const recentResponses = (q.summary?.recent_responses ?? []) as string[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {q.total_answers} answer{q.total_answers !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent>
        {recentResponses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No responses yet</p>
        ) : (
          <ul className="space-y-2">
            {recentResponses.slice(0, 10).map((text, i) => (
              <li
                key={i}
                className="text-sm border-l-2 border-muted pl-3 py-0.5"
              >
                {text}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PaginationControls({
  page,
  limit,
  total,
  slug,
  formId,
}: {
  page: number;
  limit: number;
  total: number;
  slug: string;
  formId: string;
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const baseUrl = `/projects/${slug}/forms/${formId}/responses`;

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <a
            href={`${baseUrl}?page=${page - 1}&limit=${limit}`}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            Previous
          </a>
        )}
        {page < totalPages && (
          <a
            href={`${baseUrl}?page=${page + 1}&limit=${limit}`}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            Next
          </a>
        )}
      </div>
    </div>
  );
}

// --- Main component ---

export function ResponsesContent({
  projectId,
  formId,
  questions,
  responses,
  totalResponses,
  analytics,
  page,
  limit,
  slug,
}: ResponsesContentProps) {
  const sortedQuestions = [...questions].sort(
    (a, b) => a.order_index - b.order_index
  );

  // Map question_id -> answer.value for fast lookup
  function getAnswer(
    response: ResponseWithAnswers,
    questionId: string
  ): string {
    const answer = response.answers?.find(
      (a) => a.question_id === questionId
    );
    return answer?.value ?? "";
  }

  return (
    <Tabs defaultValue="responses">
      <TabsList>
        <TabsTrigger value="responses">
          <ClipboardList className="mr-1.5 h-4 w-4" />
          Responses
        </TabsTrigger>
        <TabsTrigger value="analytics">
          <BarChart3 className="mr-1.5 h-4 w-4" />
          Analytics
        </TabsTrigger>
      </TabsList>

      {/* ---- Responses Tab ---- */}
      <TabsContent value="responses">
        {responses.length > 0 ? (
          <>
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        Submitted At
                      </TableHead>
                      {sortedQuestions.map((q) => (
                        <TableHead
                          key={q.id}
                          className="max-w-[200px] whitespace-nowrap"
                        >
                          {q.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDate(r.submitted_at)}
                        </TableCell>
                        {sortedQuestions.map((q) => (
                          <TableCell
                            key={q.id}
                            className="max-w-[200px] truncate text-sm"
                            title={getAnswer(r, q.id)}
                          >
                            {getAnswer(r, q.id) || (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <ResponseActions
                            responseId={r.id}
                            projectId={projectId}
                            formId={formId}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <PaginationControls
              page={page}
              limit={limit}
              total={totalResponses}
              slug={slug}
              formId={formId}
            />
          </>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No responses yet"
            description="Responses will appear here once users start submitting your form."
          />
        )}
      </TabsContent>

      {/* ---- Analytics Tab ---- */}
      <TabsContent value="analytics">
        {analytics && analytics.questions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {analytics.questions.map((q) => {
              if (isChoiceType(q.type)) {
                return <ChoiceSummaryCard key={q.question_id} q={q} />;
              }
              if (isNumericType(q.type)) {
                return <NumericSummaryCard key={q.question_id} q={q} />;
              }
              return <TextSummaryCard key={q.question_id} q={q} />;
            })}
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No analytics data"
            description="Analytics will appear here once your form receives responses."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
