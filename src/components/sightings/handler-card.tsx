import { Globe, Mail, MessageCircle, Phone, Smartphone, type LucideIcon } from "lucide-react";

import type { Channel } from "@/lib/sightings/routing/types";
import type { Handler } from "@/lib/sightings/types";
import { link, muted, rule, serif } from "./ui";

const KIND_ICON: Record<Channel["kind"], LucideIcon> = { app: Smartphone, portal: Globe, helpline: Phone, whatsapp: MessageCircle, email: Mail };

function ChannelRow({ c, explain }: { c: Channel; explain: boolean }) {
  const Icon = KIND_ICON[c.kind] ?? Globe;
  const address = c.url?.startsWith("mailto:") ? c.url.slice(7) : null;
  const value = c.phone ?? address;
  const href = c.url ?? (c.phone ? `${c.kind === "whatsapp" ? "https://wa.me/91" : "tel:"}${c.phone.replace(/\D/g, "").slice(-10)}` : undefined);
  const external = href?.startsWith("http");
  return (
    <li className="flex gap-3 py-3">
      <Icon className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {href ? (
            <a href={href} {...(external && { target: "_blank", rel: "noopener noreferrer" })} className={`${link} break-words`}>
              {c.label}
              {value && <span className="font-normal tabular-nums"> {value}</span>}
            </a>
          ) : (
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {c.label}
              {value && <span className="font-normal tabular-nums"> {value}</span>}
            </span>
          )}
          {c.tracked && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Gives a reference number</span>}
        </p>
        {explain && c.expect && (
          <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
            {c.expect}
            {c.needsPhone && " Asks for your mobile number."}
          </p>
        )}
      </div>
    </li>
  );
}

/** Channels with each system's "what to expect" shown once, under its first channel. */
function Channels({ channels }: { channels: Channel[] }) {
  const seen = new Set<string>();
  return (
    <ul className={`divide-y border-y ${rule}`}>
      {channels.map((c) => {
        const explain = !c.system || !seen.has(c.system);
        if (c.system) seen.add(c.system);
        return <ChannelRow key={c.label + (c.phone ?? c.url ?? "")} c={c} explain={explain} />;
      })}
    </ul>
  );
}

const FILING = "Filing is your choice. A department sees what you give it, usually your mobile number; your report on Neer Vazhvu stays anonymous.";

/** No local body listed yet for this place: the channels that take complaints from anywhere. */
export function NationalOnly({ national }: { national: Channel[] }) {
  return (
    <section className="space-y-3">
      <p className={`text-sm ${muted}`}>We have not listed the local body for this place yet. These take complaints from anywhere:</p>
      <Channels channels={national} />
      <p className={`text-sm ${muted}`}>{FILING}</p>
    </section>
  );
}

/** Who handles a report and where a citizen files it. */
export function HandlerCard({ handler, national = [] }: { handler: Handler; national?: Channel[] }) {
  return (
    <section className="space-y-3">
      <div>
        <p className={`text-sm font-medium ${muted}`}>Who handles this</p>
        <h3 className={`${serif} mt-1 text-2xl leading-tight`}>
          {handler.body}
          {handler.acronym && <span className="text-slate-500 dark:text-slate-400"> ({handler.acronym})</span>}
        </h3>
      </div>
      {handler.channels.length > 0 ? (
        <Channels channels={handler.channels.slice(0, 5)} />
      ) : (
        <p className={`text-sm ${muted}`}>This body publishes no complaint channel.</p>
      )}
      {national.length > 0 && (
        <>
          <p className={`pt-2 text-sm font-medium ${muted}`}>Also open to everyone</p>
          <Channels channels={national} />
        </>
      )}
      <p className={`text-sm ${muted}`}>
        {FILING}{" "}
        <a href={handler.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Source
        </a>
      </p>
    </section>
  );
}
