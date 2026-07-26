import { useLayoutEffect, useRef, useState } from "react";
import participantFiles from "virtual:participants";
import { useI18n } from "../../../contexts/i18n.tsx";

/**
 * One person who sent feedback: the avatar URL plus the nickname taken from the
 * filename. Names contain CJK and emoji ("🦌🔟9️⃣.jpg"), so the path segment is
 * percent-encoded — the raw name is only ever used as display text.
 */
type Participant = { name: string; src: string };

const PARTICIPANTS: Participant[] = participantFiles.map((file) => ({
  name: file.replace(/\.[^.]+$/, ""),
  src: `/participant/${encodeURIComponent(file)}`,
}));

/** Lanes of danmaku. Two reads as a stream; one lone row reads as a footer. */
const LANE_COUNT = 2;
/**
 * Drift speed per lane, in CSS px/s — staggered so the lanes visibly desync.
 * A speed rather than a duration because the track keeps growing as people are
 * added; a fixed duration would make the marquee whip along faster every time
 * the folder gains an avatar.
 */
const LANE_SPEEDS = [34, 24];
/** Minimum chips per lane before duplication, so short lists still fill wide screens. */
const MIN_PER_LANE = 6;

/** Deal the list across lanes round-robin, then pad each lane by repeating it. */
function buildLanes(people: Participant[]): Participant[][] {
  const lanes: Participant[][] = Array.from({ length: LANE_COUNT }, () => []);
  people.forEach((p, i) => lanes[i % LANE_COUNT].push(p));

  return lanes
    .filter((lane) => lane.length > 0)
    .map((lane) => {
      const repeats = Math.max(1, Math.ceil(MIN_PER_LANE / lane.length));
      return Array.from({ length: repeats }, () => lane).flat();
    });
}

function Chip({ person }: { person: Participant }) {
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full bg-brand-surface-variant/40 py-1.5 pr-4 pl-1.5">
      <img
        src={person.src}
        alt=""
        loading="lazy"
        draggable={false}
        className="h-6.5 w-6.5 rounded-full object-cover"
      />
      <span className="text-sm whitespace-nowrap text-brand-on-surface">{person.name}</span>
    </span>
  );
}

/**
 * One lane of the marquee. Renders its chips twice and derives the animation
 * duration from the measured width of a single copy, so every lane drifts at
 * `speed` px/s no matter how long the list has grown. Re-measured via
 * `ResizeObserver` because the avatars load asynchronously — the copy is
 * narrower before the images arrive than after.
 */
function Lane({ people, speed }: { people: Participant[]; speed: number }) {
  const copyRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);

  useLayoutEffect(() => {
    const copy = copyRef.current;
    if (!copy) return;

    const measure = () => {
      // Track = two copies, and it travels exactly one copy's width per cycle.
      const width = copy.getBoundingClientRect().width;
      setDuration(width > 0 ? width / speed : 0);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [speed]);

  return (
    <div
      className="thanks-marquee-track"
      // Until measured, duration is 0 — an unset animation, so the lane sits
      // still rather than flickering through a wrong-speed first frame.
      style={duration > 0 ? { animationDuration: `${duration}s` } : undefined}
    >
      {[0, 1].map((copy) => (
        <div key={copy} ref={copy === 0 ? copyRef : undefined} className="flex gap-2">
          {people.map((person, i) => (
            <Chip key={`${person.name}-${i}`} person={person} />
          ))}
          {/* Blank tail — the breather between rounds. */}
          <span className="thanks-marquee-gap" />
        </div>
      ))}
    </div>
  );
}

/**
 * The 感谢名单 marquee: participant avatars drifting right-to-left on looping
 * lanes, fading in at the right edge and out at the left.
 *
 * Seamless looping is the standard two-copy trick — each lane's chips are
 * rendered twice inside a `width: max-content` track that translates by exactly
 * -50%, so the moment the first copy has fully exited the second copy sits
 * pixel-identically where the first began. The edge fades are a CSS mask on the
 * viewport (see `.thanks-marquee` in index.css), not per-chip opacity, so they
 * hold regardless of chip width or lane speed.
 *
 * Each copy ends in a blank spacer, which is what puts a pause between rounds:
 * the lane empties out, coasts through the gap, then the names come round
 * again. Doing it as width (rather than freezing the animation partway) keeps
 * the motion constant, so the last name still drifts off-screen smoothly
 * instead of stopping dead.
 */
export function ThanksMarquee() {
  const { t } = useI18n();
  const lanes = buildLanes(PARTICIPANTS);

  if (lanes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {/* No heading: the marquee sits in the page banner, where the subtitle
          reads as the caption for the logo block above it. */}
      <p className="text-center text-xs leading-relaxed text-brand-on-surface-variant">
        {t("siteThanksDesc")}
      </p>
      {/* The lanes repeat and duplicate each name several times, which reads
          as nonsense aloud — hide the animation from AT and expose the list
          once instead. */}
      <ul className="sr-only">
        {PARTICIPANTS.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
      <div className="thanks-marquee flex flex-col gap-2" aria-hidden="true">
        {lanes.map((lane, laneIndex) => (
          <Lane key={laneIndex} people={lane} speed={LANE_SPEEDS[laneIndex] ?? 30} />
        ))}
      </div>
    </section>
  );
}
