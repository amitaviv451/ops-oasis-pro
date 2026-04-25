import { motion } from "framer-motion";
import { ArrowRight, Calendar, ClipboardList, CreditCard, Users, Zap, MapPin, BarChart3, MessageSquare, Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const } },
};

const Landing = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">FieldPro</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/register">Start free trial</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero relative overflow-hidden">
        <div className="container relative pt-20 pb-24 md:pt-28 md:pb-32">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              Now serving 2,400+ field service teams
            </div>
            <h1 className="text-balance text-4xl font-bold leading-[1.2] tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.15]">
              Run your field service business{" "}
              <span className="text-gradient-heading">
                like the best in the trade.
              </span>
            </h1>
            <p className="mt-6 text-balance text-lg text-muted-foreground md:text-xl">
              Scheduling, dispatch, estimates, invoicing, and payments — in one tool built for plumbing, HVAC, electrical, and landscaping pros.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-glow">
                <Link to="/register">Start 14-day free trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">See how it works</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No credit card required · Cancel anytime</p>
          </motion.div>

          {/* Fake dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative mx-auto mt-16 max-w-5xl"
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
              <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-3 text-xs text-muted-foreground">app.fieldpro.com/dashboard</span>
              </div>
              <div className="grid grid-cols-12 gap-4 p-6">
                <div className="col-span-3 hidden rounded-lg bg-sidebar p-4 md:block">
                  {["Dashboard","Jobs","Dispatch","Customers","Invoices","Team"].map((l,i) => (
                    <div key={l} className={`mb-1 rounded px-3 py-2 text-xs ${i===0?'bg-sidebar-accent text-sidebar-accent-foreground':'text-sidebar-foreground'}`}>{l}</div>
                  ))}
                </div>
                <div className="col-span-12 md:col-span-9">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      { l: "Open jobs", v: "47" },
                      { l: "Revenue MTD", v: "$84.2k" },
                      { l: "New leads", v: "23" },
                      { l: "Unpaid", v: "$12.4k" },
                    ].map((k) => (
                      <div key={k.l} className="rounded-lg border border-border bg-gradient-card p-4">
                        <div className="text-xs text-muted-foreground">{k.l}</div>
                        <div className="mt-1 text-2xl font-bold">{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex h-40 items-end gap-2 rounded-lg border border-border bg-gradient-card p-4">
                    {[40,55,38,72,60,85].map((h,i) => (
                      <div key={i} className="flex-1 rounded-t bg-gradient-primary" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -inset-x-12 -bottom-8 h-32 bg-gradient-to-t from-background to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border py-24">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Everything you need</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">One platform. Every workflow.</h2>
            <p className="mt-4 text-muted-foreground">From the first call to the final paid invoice, FieldPro handles the busywork so you can focus on the trade.</p>
          </motion.div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Calendar, t: "Smart scheduling", d: "Drag-and-drop dispatch board with technician calendars and route optimization." },
              { icon: ClipboardList, t: "Jobs & estimates", d: "Build estimates from your price book in seconds. Convert to job in one click." },
              { icon: CreditCard, t: "Invoicing & payments", d: "Send branded invoices, accept card payments, and track what's owed automatically." },
              { icon: Users, t: "CRM that works", d: "Every customer's full job history, equipment, notes, and lifetime value at a glance." },
              { icon: MapPin, t: "Service areas", d: "Define your zones, route smarter, and stop driving across town for nothing." },
              { icon: BarChart3, t: "Reports that matter", d: "Revenue, technician performance, lead sources — see what's working in real time." },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-gradient-card p-6 shadow-soft transition-all hover:shadow-elegant hover:-translate-y-0.5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-secondary/30 py-24">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Up and running in an afternoon.</h2>
          </motion.div>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {[
              { n: "01", t: "Sign up & set up", d: "Create your company account, invite your team, and import your customer list." },
              { n: "02", t: "Schedule & dispatch", d: "Book jobs, assign technicians, and watch your day come together on the dispatch board." },
              { n: "03", t: "Get paid faster", d: "Send invoices on-site, accept card payments, and skip the chasing." },
            ].map((s, i) => (
              <motion.div key={s.n} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.1 }}>
                <div className="text-5xl font-bold text-primary/20">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-border py-24">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Loved by service pros across the country.</h2>
          </motion.div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { q: "We invoiced 3x faster the first month. Honestly changed how we run.", n: "Marcus R.", r: "Owner, R&R Plumbing" },
              { q: "Switched from Housecall and saved $400/mo. The dispatch board alone is worth it.", n: "Jen T.", r: "Ops Manager, ClimateCare HVAC" },
              { q: "My techs actually like using it. That never happens with software.", n: "Diego L.", r: "Owner, Voltage Electric" },
            ].map((t) => (
              <motion.div key={t.n} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="rounded-xl border border-border bg-card p-6 shadow-soft">
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-4 text-foreground">"{t.q}"</p>
                <div className="mt-6">
                  <div className="font-semibold">{t.n}</div>
                  <div className="text-sm text-muted-foreground">{t.r}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-secondary/30 py-24">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Simple plans. Built to scale.</h2>
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-card p-1 text-sm shadow-soft">
              <button onClick={() => setAnnual(false)} className={`rounded-full px-4 py-1.5 transition-all ${!annual ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>Monthly</button>
              <button onClick={() => setAnnual(true)} className={`rounded-full px-4 py-1.5 transition-all ${annual ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>Annual <span className="ml-1 text-xs opacity-70">save 20%</span></button>
            </div>
          </motion.div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
            {[
              { name: "Starter", price: 79, blurb: "For solo operators getting organized.", features: ["Up to 2 users", "Jobs & scheduling", "Invoicing", "Customer CRM", "Email support"] },
              { name: "Growth", price: 149, blurb: "For growing crews running real ops.", features: ["Up to 10 users", "Everything in Starter", "Dispatch board", "Estimates & price book", "Inventory", "Priority support"], highlight: true },
              { name: "Enterprise", price: 299, blurb: "For multi-location service businesses.", features: ["Unlimited users", "Everything in Growth", "Service areas", "Advanced reports", "Custom roles", "Dedicated CSM"] },
            ].map((p) => {
              const price = annual ? Math.round(p.price * 0.8) : p.price;
              return (
                <motion.div key={p.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className={`relative flex flex-col rounded-2xl border p-7 ${p.highlight ? 'border-primary bg-card shadow-glow' : 'border-border bg-card shadow-soft'}`}>
                  {p.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Most popular</div>}
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <Button asChild className="mt-6" variant={p.highlight ? "default" : "outline"}>
                    <Link to="/register">Start free trial</Link>
                  </Button>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border py-24">
        <div className="container max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Questions, answered.</h2>
          </motion.div>
          <Accordion type="single" collapsible className="mt-12">
            {[
              { q: "How long is the free trial?", a: "14 days, full access to every feature on the Growth plan. No credit card required." },
              { q: "Can I import data from Workiz or Housecall Pro?", a: "Yes — we offer guided CSV import for customers, jobs, and price books. Our team will help you migrate." },
              { q: "Do my technicians need their own logins?", a: "Yes. Each plan includes a number of seats. Technicians get a mobile-optimized view of their schedule and jobs." },
              { q: "Does it work offline?", a: "The technician mobile app caches today's jobs, so your crew can keep working in low-signal areas." },
              { q: "What about payments?", a: "Accept ACH and credit cards directly through invoices. Industry-standard processing rates apply." },
            ].map((f, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-hero py-24">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-12 text-center shadow-elevated">
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to run a tighter ship?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Start your free 14-day trial. No credit card. No call with sales.</p>
            <Button asChild size="lg" className="mt-8 shadow-glow">
              <Link to="/register">Get started <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded bg-gradient-primary">
              <Zap className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">FieldPro</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
