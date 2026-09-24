"use client";

import { age, allocation, brand, composition, footer, hero, ritual } from "@/lib/brand";
import { AllocationCTA } from "./AllocationCTA";

/**
 * The scroll track. Each chapter is one viewport of scroll during which the
 * fixed 3D composition moves to a new pose; copy is positioned around where
 * the bottle will be, not stacked in blocks.
 */
export function Chapters({ fallback }: { fallback: boolean }) {
  return (
    <div className="track" data-track id="top">
      <section className="chapter chapter--hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="sr-only">
          {brand.name} — glacial aquifer water from the {brand.source}
        </h1>
        <div className="hero__foot" data-quiet>
          <div className="hero__intro">
            <p className="kicker mono" data-hero-reveal>
              {hero.kicker}
            </p>
            <p className="hero__line display" data-hero-reveal>
              {hero.line}
            </p>
          </div>
          <div className="hero__cue" data-hero-reveal>
            <span className="mono">{brand.coordinates}</span>
            <span className="cue mono" aria-hidden="true">
              <span className="cue__line" />
              {hero.scroll}
            </span>
          </div>
        </div>
      </section>

      <section className="chapter chapter--age" data-chapter aria-labelledby="age-title">
        <div className="age__copy" data-quiet>
          <p className="index mono" data-reveal>
            {age.index}
          </p>
          <h2 id="age-title" className="title display" data-reveal>
            {age.title[0]}
            <br />
            <span className="title__soft">{age.title[1]}</span>
          </h2>
          <p className="body" data-reveal>
            {age.body}
          </p>
          <p className="meta mono" data-reveal>
            {age.meta}
          </p>
        </div>
      </section>

      <section className="chapter chapter--composition" data-chapter aria-labelledby="comp-title">
        <div className="comp__copy" data-quiet>
          <p className="index mono" data-reveal>
            {composition.index}
          </p>
          <h2 id="comp-title" className="title title--small display" data-reveal>
            {composition.title}
          </h2>
          {/* The readable data. In 3D mode the projected annotations mirror it. */}
          <dl className={`minerals ${fallback ? "" : "minerals--hidden"}`} data-reveal>
            {composition.minerals.map((m) => (
              <div key={m.key} className="minerals__row">
                <dt>{m.key}</dt>
                <dd className="mono">
                  {m.value}
                  {m.unit && <span className="minerals__unit"> {m.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="note" data-reveal>
            {composition.note}
          </p>
        </div>
      </section>

      <section className="chapter chapter--ritual" data-chapter aria-labelledby="ritual-title">
        <div className="ritual__copy" data-quiet>
          <p className="index mono" data-reveal>
            {ritual.index}
          </p>
          <h2 id="ritual-title" className="title display" data-reveal>
            {ritual.title[0]}
            <br />
            <span className="title__soft">{ritual.title[1]}</span>
          </h2>
          <p className="body" data-reveal>
            {ritual.body}
          </p>
          <p className="count mono" data-reveal>
            <span>{ritual.count}</span> {ritual.countNote}
          </p>
        </div>
      </section>

      <section className="chapter chapter--allocation" data-chapter aria-labelledby="alloc-title">
        <div className="alloc__copy" data-quiet>
          <p className="kicker mono" data-reveal>
            {allocation.kicker}
          </p>
          <h2 id="alloc-title" className="title display" data-reveal>
            {allocation.title[0]}
            <br />
            <span className="title__soft">{allocation.title[1]}</span>
          </h2>
        </div>
        <div className="alloc__action" data-quiet>
          <AllocationCTA />
        </div>
        <footer className="colophon mono" data-quiet>
          <span>{footer.credit}</span>
          <span>{footer.disclaimer}</span>
        </footer>
      </section>
    </div>
  );
}
