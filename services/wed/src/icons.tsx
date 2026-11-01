import type { SVGProps } from "react";
import type { ReactNode } from "react";

type IconName = "add" | "refresh" | "calendar" | "chat" | "check" | "chevron" | "clipboard" | "heart" | "home" | "location" | "people" | "pill" | "shield" | "bag";

function Glyph({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  const drawings: Record<IconName, ReactNode> = {
    add: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 17 6l3 6M4 12l3 6a7 7 0 0 0 11.5-3" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.2-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11.5h8M8 14.5h5" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    clipboard: <><rect x="5" y="4.5" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
    heart: <><path d="M20 8.5a5 5 0 0 0-8-4 5 5 0 0 0-8 4c0 5 8 11.5 8 11.5s8-6.5 8-11.5Z" /><path d="M3.5 12h4l2-4 3.2 8 2-4H20" /></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h.5a5.5 5.5 0 0 1 5.5 5.5V20ZM16 5.5a3 3 0 0 1 0 5.8M17 13a5 5 0 0 1 3.5 4.8V20h-3" /></>,
    pill: <><path d="M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0Z" /><path d="m8.5 8.5 7 7" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2M9 12v1M15 12v1" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common} {...props}>{drawings[name]}</svg>;
}

export const Add24Regular = () => <Glyph name="add" />;
export const ArrowClockwise24Regular = () => <Glyph name="refresh" />;
export const CalendarLtr24Regular = () => <Glyph name="calendar" />;
export const Chat24Regular = () => <Glyph name="chat" />;
export const CheckmarkCircle20Regular = () => <Glyph name="check" />;
export const ChevronRight20Regular = () => <Glyph name="chevron" />;
export const ClipboardTask24Regular = () => <Glyph name="clipboard" />;
export const HeartPulse24Regular = () => <Glyph name="heart" />;
export const Home24Regular = () => <Glyph name="home" />;
export const Location24Regular = () => <Glyph name="location" />;
export const People24Regular = () => <Glyph name="people" />;
export const Pill24Regular = () => <Glyph name="pill" />;
export const ShieldCheckmark24Regular = () => <Glyph name="shield" />;
export const ShoppingBag24Regular = () => <Glyph name="bag" />;
