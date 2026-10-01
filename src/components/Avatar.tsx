import { classIcon, gameImage } from "@/lib/assets";
import { classColor, initials } from "@/lib/classes";
import type { CharacterProfile } from "@/lib/types";

/** Visuel du personnage : symbole de sa classe sur fond de couleur, avec sa tête en pastille. */
export function Avatar({ profile, size }: { profile: CharacterProfile; size?: "lg" }) {
  const image = gameImage(profile.classImage) ?? classIcon(profile.className);
  return (
    <div
      className={size === "lg" ? "avatar lg" : "avatar"}
      style={{ "--c": classColor(profile.className) } as React.CSSProperties}
      aria-hidden
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="symbol" src={image} alt="" loading="lazy" />
      ) : (
        initials(profile.className)
      )}
      {size === "lg" && profile.headImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="head" src={gameImage(profile.headImage)} alt="" />
      )}
    </div>
  );
}
