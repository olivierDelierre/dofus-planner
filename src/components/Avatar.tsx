import { classColor, initials } from "@/lib/classes";
import type { DofusbookProfile } from "@/lib/types";

/** Visuel de classe : image DofusBook si disponible, sinon initiales sur la couleur de la classe. */
export function Avatar({ profile, size }: { profile: DofusbookProfile; size?: "lg" }) {
  return (
    <div
      className={size === "lg" ? "avatar lg" : "avatar"}
      style={{ "--c": classColor(profile.className) } as React.CSSProperties}
      aria-hidden
    >
      {profile.classImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.classImage} alt="" loading="lazy" />
      ) : (
        initials(profile.className)
      )}
    </div>
  );
}
