import type { Channel } from "@/lib/sightings/routing/types";
import type { Handler } from "@/lib/sightings/types";

function ChannelLink({ c }: { c: Channel }) {
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
    </li>
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
        <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-300">
          {handler.channels.slice(0, 5).map((c) => (
            <ChannelLink key={c.label + (c.phone ?? c.url ?? "")} c={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-slate-600 dark:text-slate-400">This body publishes no complaint channel.</p>
      )}
      {national.length > 0 && (
        <>
          <p className="mt-3 text-slate-500 dark:text-slate-400">Also open to everyone</p>
          <ul className="mt-1 space-y-1 text-slate-700 dark:text-slate-300">
            {national.map((c) => (
              <ChannelLink key={c.label} c={c} />
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Filed it? Add the reference number under My reports so its progress stays on the record.{" "}
        <a href={handler.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Source
        </a>
      </p>
    </div>
  );
}
