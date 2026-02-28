import { type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="py-16">
      <CardHeader className="flex flex-col items-center text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2 max-w-sm">{description}</CardDescription>
        {action && <div className="mt-4">{action}</div>}
      </CardHeader>
    </Card>
  );
}
