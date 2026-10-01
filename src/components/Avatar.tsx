import { classIcon } from "@/lib/assets";
import { classColor, initials } from "@/lib/classes";
import type { DofusbookProfile } from "@/lib/types";

/** Visuel de classe : image DofusBook si disponible, sinon symbole officiel, sinon initiales sur la couleur de la classe. */
export function Avatar({ profile, size }: { profile: DofusbookProfile; size?: "lg" }) {
  const image = profile.classImage ?? classIcon(profile.className);
  return (
    <div
      className={size === "lg" ? "avatar lg" : "avatar"}
      style={{ "--c": classColor(profile.className) } as React.CSSProperties}
      aria-hidden
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" />
      ) : (
        initials(profile.className)
      )}
    </div>
  );
}
