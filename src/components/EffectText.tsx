import { effectIcon, statIcon } from "@/lib/assets";

/** Effet d'objet façon infobulle du jeu : icône, valeur en vert, puis nom de la caractéristique. `text` : « 40 Force », « 3% Critique »… */
export function EffectText({ text, label }: { text: string; label?: string }) {
  const icon = label ? statIcon("", label) : effectIcon(text);
  const m = /^([+-]?\d+%?)\s+(.+)$/.exec(text);
  return (
    <span className="effect">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ico" src={icon} alt="" />
      ) : (
        <span className="ico ico-empty" aria-hidden />
      )}
      {m ? (
        <>
          <b className="fx-val">{m[1]}</b>
          <span className="fx-name">{m[2]}</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}
