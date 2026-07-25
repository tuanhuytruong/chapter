import type { ReactNode } from "react";
import type { AvatarPresetId } from "../avatar-presets";

const colors: Record<AvatarPresetId, { bg: string; main: string; dark: string; soft: string }> = {
  otter: { bg: "#E9DDD0", main: "#A87552", dark: "#53392D", soft: "#F7EEDF" },
  "red-panda": { bg: "#F4E0CF", main: "#C86D43", dark: "#5C372B", soft: "#FFF7EE" },
  cat: { bg: "#E6E7D7", main: "#879476", dark: "#384334", soft: "#F8F4E9" },
  rabbit: { bg: "#E9E2F2", main: "#A595B5", dark: "#51435D", soft: "#FBF8FF" },
  panda: { bg: "#E5E8E3", main: "#FAF8F0", dark: "#354039", soft: "#C8D4C5" },
  bear: { bg: "#EEE1C5", main: "#9B7651", dark: "#4D3828", soft: "#F8F1E2" },
  koala: { bg: "#DAE4DE", main: "#92A7A0", dark: "#405450", soft: "#F1F5F0" },
  penguin: { bg: "#DAE9EE", main: "#3F555D", dark: "#25383E", soft: "#FAF7EE" },
};

export default function AnimalAvatar({ id, alt = "", className = "" }: { id: AvatarPresetId; alt?: string; className?: string }) {
  const c = colors[id];
  const face = <><circle cx="50" cy="53" r="30" fill={c.main}/><circle cx="39" cy="51" r="3.5" fill={c.dark}/><circle cx="61" cy="51" r="3.5" fill={c.dark}/></>;
  let art: ReactNode = face;
  if (id === "otter") art = <><circle cx="30" cy="35" r="12" fill={c.main}/><circle cx="70" cy="35" r="12" fill={c.main}/>{face}<ellipse cx="50" cy="63" rx="13" ry="10" fill={c.soft}/><ellipse cx="50" cy="61" rx="5" ry="3.5" fill={c.dark}/></>;
  if (id === "red-panda") art = <><path d="M23 45 28 18l17 14h10l17-14 5 27" fill={c.dark}/>{face}<path d="M28 61q22 14 44 0v10q-22 17-44 0Z" fill={c.soft}/><circle cx="50" cy="61" r="4" fill={c.dark}/></>;
  if (id === "cat") art = <><path d="m25 47 4-29 18 15h6l18-15 4 29" fill={c.main}/>{face}<path d="M45 61h10l-5 5Z" fill={c.dark}/><path d="M35 65h11m8 0h11" stroke={c.dark} strokeWidth="2" strokeLinecap="round"/></>;
  if (id === "rabbit") art = <><ellipse cx="34" cy="27" rx="10" ry="20" fill={c.main}/><ellipse cx="66" cy="27" rx="10" ry="20" fill={c.main}/><ellipse cx="34" cy="27" rx="4" ry="13" fill={c.soft}/><ellipse cx="66" cy="27" rx="4" ry="13" fill={c.soft}/>{face}<path d="M46 61h8l-4 4Z" fill={c.dark}/></>;
  if (id === "panda") art = <><circle cx="31" cy="39" r="14" fill={c.dark}/><circle cx="69" cy="39" r="14" fill={c.dark}/><circle cx="29" cy="26" r="10" fill={c.dark}/><circle cx="71" cy="26" r="10" fill={c.dark}/>{face}<ellipse cx="50" cy="64" rx="8" ry="6" fill={c.soft}/></>;
  if (id === "bear") art = <><circle cx="29" cy="29" r="12" fill={c.main}/><circle cx="71" cy="29" r="12" fill={c.main}/>{face}<ellipse cx="50" cy="64" rx="12" ry="9" fill={c.soft}/><ellipse cx="50" cy="62" rx="4" ry="3" fill={c.dark}/></>;
  if (id === "koala") art = <><circle cx="27" cy="42" r="17" fill={c.dark}/><circle cx="73" cy="42" r="17" fill={c.dark}/>{face}<ellipse cx="50" cy="62" rx="9" ry="12" fill={c.dark}/></>;
  if (id === "penguin") art = <><ellipse cx="50" cy="51" rx="29" ry="35" fill={c.main}/><ellipse cx="50" cy="61" rx="18" ry="20" fill={c.soft}/><circle cx="39" cy="48" r="3.5" fill={c.dark}/><circle cx="61" cy="48" r="3.5" fill={c.dark}/><path d="m44 56 6 8 6-8Z" fill="#D89449"/></>;
  return <svg viewBox="0 0 100 100" role={alt ? "img" : undefined} aria-label={alt || undefined} className={className}><rect width="100" height="100" rx="24" fill={c.bg}/>{art}</svg>;
}
