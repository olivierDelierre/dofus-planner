import { effectIcon, statIcon } from "@/lib/assets";

/** Effet d'objet avec l'icône de sa caractéristique (quand elle existe). `text` : « 40 Force », « 3% Critique »… */
export function EffectText({ text, label }: { text: string; label?: string }) {
  const icon = label ? statIcon("", label) : effectIcon(text);
  return (
    <span className="effect">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ico" src={icon} alt="" />
      ) : (
        <span className="ico ico-empty" aria-hidden />
      )}
      {text}
    </span>
  );
}
