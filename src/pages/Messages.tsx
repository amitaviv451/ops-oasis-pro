import { useEffect, useMemo, useState } from "react";
import { Plus, MessageSquare, Mail, Phone, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Channel = "SMS" | "EMAIL" | "CALL";
type Direction = "INBOUND" | "OUTBOUND";

interface Msg {
  id: string;
  channel: Channel;
  direction: Direction;
  contact_name: string;
  body: string;
  created_at: string;
}

const channelIcon = { SMS: MessageSquare, EMAIL: Mail, CALL: Phone };

const empty = { channel: "SMS" as Channel, direction: "OUTBOUND" as Direction, contact_name: "", body: "" };

const Messages = () => {
  const orgId = useOrgId();
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Msg[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Msg[]>();
    items.forEach((m) => {
      if (!map.has(m.contact_name)) map.set(m.contact_name, []);
      map.get(m.contact_name)!.push(m);
    });
    return Array.from(map.entries());
  }, [items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim() || !form.body.trim())
      return toast({ title: "Contact and message are required", variant: "destructive" });
    if (!orgId) return;
    setSaving(true);
    const { error } = await supabase.from("messages").insert({
      organization_id: orgId,
      channel: form.channel,
      direction: form.direction,
      contact_name: form.contact_name.trim(),
      body: form.body.trim(),
    });
    setSaving(false);
    if (error) return toast({ title: "Send failed", description: error.message, variant: "destructive" });
    toast({ title: "Message logged" });
    setForm(empty);
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">Log every customer touchpoint in one timeline.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Log message</Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><MessageSquare className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">No messages yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Log your first call, text, or email to start a thread.</p>
            <Button onClick={() => setOpen(true)} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Log message</Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([contact, msgs]) => (
              <div key={contact} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                      {contact[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{contact}</div>
                      <div className="text-xs text-muted-foreground">{msgs.length} message{msgs.length === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(msgs[0].created_at), { addSuffix: true })}</span>
                </div>
                <div className="mt-3 space-y-2 pl-12">
                  {msgs.slice(0, 3).map((m) => {
                    const Icon = channelIcon[m.channel];
                    const out = m.direction === "OUTBOUND";
                    return (
                      <div key={m.id} className={cn("rounded-lg border p-3", out ? "border-primary/20 bg-primary/5" : "border-border bg-background")}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Icon className="h-3 w-3" />
                          {out ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          <span>{m.channel}</span>
                          <span>·</span>
                          <span>{format(new Date(m.created_at), "MMM d, h:mm a")}</span>
                        </div>
                        <p className="mt-1 text-sm">{m.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Log message</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v: Channel) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMS">SMS</SelectItem><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="CALL">Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Direction</Label>
                <Select value={form.direction} onValueChange={(v: Direction) => setForm({ ...form, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTBOUND">Outbound</SelectItem><SelectItem value="INBOUND">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Contact</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Customer name" autoFocus /></div>
            <div className="space-y-2"><Label>Message</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What was discussed?" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Log message"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
