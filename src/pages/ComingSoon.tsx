import { Construction } from "lucide-react";

const ComingSoon = ({ title }: { title: string }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">This module is part of the next phase.</p>
    </div>
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Construction className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title} — coming soon</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We're rolling out modules one at a time so each gets the polish it deserves. Tell the team to build this one next.
      </p>
    </div>
  </div>
);

export default ComingSoon;
