import type { Channel } from "@/lib/sightings/routing/types";
import type { Handler } from "@/lib/sightings/types";

function ChannelLink({ c, explain }: { c: Channel; explain: boolean }) {
  const address = c.url?.startsWith("mailto:") ? c.url.slice(7) : null;
  const text = c.phone ? `${c.label}: ${c.phone}` : address ? `${c.label}: ${address}` : c.label;
  const href = c.url ?? (c.phone ? `${c.kind === "whatsapp" ? "https://wa.me/91" : "tel:"}${c.phone.replace(/\D/g, "").slice(-10)}` : undefined);
  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-800 underline underline-offset-2 dark:text-cyan-400">
          {text}
        </a>
      ) : (
        text
      )}
      {c.tracked && <span className="text-slate-500 dark:text-slate-400"> (gives a reference number)</span>}
      {explain && c.expect && (
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {c.expect}
          {c.needsPhone && " Asks for your mobile number."}
        </p>
      )}
    </li>
  );
}

/** Channels with each system's "what to expect" shown once, under its first channel. */
function Channels({ channels }: { channels: Channel[] }) {
  const seen = new Set<string>();
  return (
    <ul className="mt-1 space-y-1.5 text-slate-700 dark:text-slate-300">
      {channels.map((c) => {
        const explain = !c.system || !seen.has(c.system);
        if (c.system) seen.add(c.system);
        return <ChannelLink key={c.label + (c.phone ?? c.url ?? "")} c={c} explain={explain} />;
      })}
    </ul>
  );
}

/** No local body listed yet for this place: the channels that take complaints from anywhere. */
export function NationalOnly({ national }: { national: Channel[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <p className="text-slate-700 dark:text-slate-300">
        We have not listed the local body for this place yet. These channels take complaints from anywhere:
      </p>
      <Channels channels={national} />
    </div>
  );
}

/** Who handles a report and where a citizen files it. */
export function HandlerCard({ handler, national = [] }: { handler: Handler; national?: Channel[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <p className="text-slate-500 dark:text-slate-400">Handled by</p>
      <p className="font-semibold text-slate-900 dark:text-slate-100">
        {handler.body}
        {handler.acronym && ` (${handler.acronym})`}
      </p>
      {handler.channels.length > 0 ? (
        <Channels channels={handler.channels.slice(0, 5)} />
      ) : (
        <p className="mt-2 text-slate-600 dark:text-slate-400">This body publishes no complaint channel.</p>
      )}
      {national.length > 0 && (
        <>
          <p className="mt-3 text-slate-500 dark:text-slate-400">Also open to everyone</p>
          <Channels channels={national} />
        </>
      )}
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
        Filing is your choice. A department you file with will know who you are, since most ask for your mobile number; your report on
        Neer Vazhvu stays anonymous either way. If you file, add the reference number under My reports so its progress stays on the
        record.{" "}
        <a href={handler.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Source
        </a>
      </p>
    </div>
  );
}
