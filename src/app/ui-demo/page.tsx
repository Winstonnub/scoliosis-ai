import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function UiDemoPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>UI Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge>shadcn/ui + Tailwind</Badge>
            <Input placeholder="Type something..." />
            <Button>Button works</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
