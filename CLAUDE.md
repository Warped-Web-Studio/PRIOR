@AGENTS.md

# CLAUDE.md

## Project Overview

This project is an experimental luxury bottled water landing page created as a portfolio piece for Warped Web Studio.

It is not intended to resemble a conventional beverage website.

The experience should feel closer to:

- luxury product cinematography
- high-end fragrance advertising
- fashion campaign websites
- premium automotive product reveals
- experimental digital design
- interactive WebGL experiences

The central design idea is simple:

> The product is part of the interface.

A premium glass water bottle is the primary visual object throughout the experience. The bottle, water, glass, light, typography, camera, and motion should work together as a single art-directed system.

The intended reaction is:

> "Wait, this is a website?"

This project should push technical and visual boundaries while remaining coherent, performant, responsive, and usable.

---

# Core Philosophy

## Experience Before Sections

Do not approach this project as:

Hero
About
Features
Story
CTA
Contact

The page should feel like one continuous experience.

Traditional content sections may exist structurally, but they should not feel like disconnected rectangular blocks stacked vertically.

Scrolling should evolve the composition rather than simply reveal another section.

Think in terms of:

- scenes
- states
- camera movement
- object movement
- lighting changes
- typography
- depth
- transitions
- physical cause and effect

The experience should feel spatial.

---

# The Product Is the Interface

The bottle is not decorative artwork placed beside normal website content.

It is a primary interface object.

The bottle may respond to:

- initial page load
- scrolling
- pointer movement where appropriate
- section progression
- CTA interaction
- environmental lighting
- camera movement

Whenever possible, interactions should feel physically connected to the product.

Examples:

- bottle rotation reveals branding
- scrolling changes bottle orientation
- typography passes behind or through the bottle
- glass refracts content
- water reacts to interaction
- the CTA causes the bottle to physically pour
- the resulting splash becomes navigation

Avoid adding effects that have no conceptual relationship to the product.

---

# Signature Interaction

The most important interaction in the project is the transition from the main product experience into the inquiry experience.

The sequence is:

1. User activates the primary CTA.
2. The surrounding interface quiets.
3. Attention shifts entirely to the bottle.
4. The bottle lifts or repositions.
5. The bottle begins tilting.
6. Water begins pouring from the bottle.
7. Water falls toward the lower portion of the viewport.
8. The water impacts an implied surface or camera plane.
9. A splash develops.
10. The splash expands toward the viewer.
11. Water progressively covers the viewport.
12. The underlying environment changes while hidden by the water.
13. The water clears or resolves.
14. The inquiry environment is revealed.

This must feel like one continuous physical event.

The user should intuitively understand:

> I interacted with the bottle, the bottle poured, the water hit the screen, and the water transported me somewhere else.

There should be no obvious separation between "animation" and "page transition."

---

# Motion Philosophy

Motion quality is one of the highest priorities in this project.

Motion must feel:

- deliberate
- weighted
- cinematic
- smooth
- physical
- controlled
- premium

Avoid:

- abrupt state changes
- linear animation
- generic easing everywhere
- excessive bouncing
- cartoon physics
- unnecessary spring animation
- snapping between camera positions
- instant scene changes
- animations that exist only to show technical ability

Important movement should include believable acceleration and deceleration.

Objects should appear to possess mass.

Camera movement should feel intentional.

The website should never feel like a collection of GSAP demos.

---

# Transition Timing

The bottle pour and splash sequence must be long enough for the viewer to understand the physical event.

It must also remain short enough that navigation never feels tedious.

A useful starting range for the entire sequence is approximately:

3 to 5 seconds.

This is not a hardcoded requirement.

Timing must be tuned through actual visual testing.

A possible timing structure:

0.0s
CTA activated.

0.0 to 0.35s
Environment quiets and attention moves toward bottle.

0.35 to 1.4s
Bottle lifts, repositions, and begins tilting.

0.9 to 2.2s
Water begins pouring.

2.0 to 3.0s
Water impacts and splash expands.

2.7 to 3.5s
Water increasingly occupies the viewport.

3.0 to 3.7s
Scene change may occur behind sufficient water coverage.

3.3 to 4.2s
Water clears or resolves into the inquiry environment.

These values exist only as starting points.

Do not blindly implement these numbers.

Tune them based on how the experience actually looks and feels.

There should never be a period where nothing visually meaningful is happening while the user waits.

---

# Physical Cause and Effect

Major interactions should have understandable cause and effect.

For the signature transition:

CTA
↓
Bottle reacts
↓
Bottle tilts
↓
Water pours
↓
Water impacts
↓
Splash expands
↓
Screen becomes water
↓
Environment changes
↓
Inquiry experience appears

Never replace this with:

CTA
↓
Splash overlay
↓
Fade
↓
Form

The physical sequence is the experience.

---

# Water

Water is a central visual and interaction system.

The goal is not physically accurate fluid simulation.

The goal is:

> Art-directed water that is visually convincing.

Favor controlled illusion over expensive simulation.

Possible techniques include:

- custom shaders
- particle systems
- animated geometry
- metaball-like effects
- displacement
- refraction
- distortion
- procedural textures
- screen-space effects
- compositing
- combinations of these techniques

Choose techniques based on:

- visual quality
- controllability
- performance
- transition requirements
- browser compatibility

Do not implement computationally expensive fluid simulation merely because it is technically impressive.

The water must serve the art direction.

---

# Splash Transition Architecture

The splash is not an effect added before a normal page transition.

The splash itself IS the transition.

Architect it accordingly.

The transition system must coordinate:

- bottle animation
- water pour
- splash generation
- viewport coverage
- camera state
- DOM state
- scene state
- background/environment state
- inquiry reveal

Use a deterministic timeline or state system.

GSAP timelines or an equivalent approach are appropriate.

Avoid loosely coordinated independent timeouts.

The sequence should be reproducible and resistant to race conditions.

---

# Initial Bottle Reveal

The initial page load should behave like a product reveal.

The bottle should not begin perfectly facing the viewer.

Initial state:

- bottle rotated partially away
- branding obscured or partially obscured
- restrained lighting
- minimal surrounding content

After visual readiness:

1. Brief pause.
2. Bottle begins rotating.
3. Lighting moves naturally across the glass.
4. Branding becomes visible.
5. Typography coordinates with the reveal.
6. Bottle reaches its hero orientation.
7. Motion settles naturally.

The bottle should appear to have physical weight.

Do not use a generic constant-speed rotation.

After settling, extremely subtle secondary motion may keep the scene alive.

---

# Bottle Rendering

The bottle must feel like a luxury physical object.

Prioritize:

- convincing glass
- visible water volume
- refraction
- reflections
- realistic highlights
- appropriate roughness
- subtle imperfections
- premium label or embossed branding
- believable thickness
- studio-style lighting
- depth

Avoid the common "transparent 3D plastic object" appearance.

Lighting is critical.

Do not compensate for weak materials by adding excessive lights.

Darkness and negative space are part of the visual design.

---

# Branding

The brand is fictional.

Create an original luxury bottled water identity.

The brand should take itself completely seriously.

Do not make the branding comedic even if the premise is intentionally extravagant.

The brand may communicate:

- rarity
- geological origin
- mineral composition
- purity
- altitude
- age
- provenance
- limited harvesting
- ritual
- scarcity
- exclusivity

The visual identity should remain restrained.

Avoid obvious luxury clichés.

Do not automatically use:

- gold everywhere
- generic Didot-style serif typography
- black and gold combinations
- excessive letter spacing
- fake French branding
- meaningless Latin
- generic "premium" language

Create something that feels like a real contemporary luxury brand.

---

# Copy

Keep copy minimal.

The website should communicate primarily through:

- composition
- product
- movement
- typography
- interaction
- atmosphere

Do not fill the page with marketing paragraphs.

Short statements are preferred.

Every line should feel intentional.

Avoid generic phrases such as:

- Elevate your experience
- Redefining hydration
- Where luxury meets purity
- Experience the difference
- Crafted for excellence
- Premium hydration reimagined

If copy sounds like generic AI-generated luxury copy, rewrite it.

---

# Typography

Typography is a major visual element.

Treat type as part of the composition rather than simply content placed over the scene.

Explore relationships between typography and depth.

Possible techniques:

- typography behind bottle
- typography partially obscured by bottle
- refracted typography
- large-scale type entering/exiting frame
- text synchronized with camera movement
- typography affected by scene progression
- layered foreground/background type

Maintain readability where information matters.

Experimental typography must remain intentional.

---

# Scroll Behavior

Scrolling should progress the experience.

Do not use scroll effects merely because they are available.

Scroll may control:

- camera position
- bottle position
- bottle rotation
- lighting
- typography
- scene state
- water state
- environmental changes

Scroll-linked animation should feel smooth and predictable.

Avoid making the user fight the page.

Do not create excessively long scroll distances simply to show animation.

The relationship between scroll distance and visual progression should feel natural.

---

# Inquiry Environment

After the water transition, the user enters a distinct visual environment.

The main product environment should feel:

- dark
- mysterious
- cinematic
- product-focused

The inquiry environment should provide contrast.

Potential qualities:

- bright
- pale
- mineral
- icy
- translucent
- calm
- clean

It should feel like emerging through water into another space.

Do not use a conventional modal.

Do not make the transition end with a normal white rectangle appearing over the existing scene.

The inquiry experience should feel like another environment.

---

# Inquiry Form

Keep the form minimal.

Potential heading:

REQUEST ACCESS

Potential fields:

- Name
- Email
- Company / Organization
- What brings you to the source?

Potential submit language:

ENTER

The exact language may evolve with the brand.

The form must:

- be keyboard accessible
- provide clear labels
- validate required fields
- provide understandable errors
- provide visible focus states
- work without relying exclusively on animation

Do not overbuild backend functionality unless explicitly requested.

---

# Visual Direction

The project should feel art-directed rather than component-driven.

Prioritize:

- scale
- contrast
- negative space
- depth
- lighting
- composition
- motion
- texture
- typography
- physical interaction

Avoid defaulting to:

- bento grids
- feature card grids
- excessive rounded cards
- pill-shaped everything
- generic glassmorphism
- random gradient blobs
- meaningless floating particles
- repetitive sections
- excessive iconography
- SaaS-style layouts
- generic landing page structures

If the page starts looking like a normal startup landing page with a Three.js bottle pasted on top, stop and reconsider the composition.

---

# Technical Philosophy

Use technology to support the experience.

Do not use technology simply to demonstrate that it can be used.

Potential tools may include:

- React
- Next.js
- TypeScript
- Three.js
- React Three Fiber
- Drei
- GSAP
- custom GLSL shaders
- WebGL
- CSS
- modern browser APIs

Use only what materially improves the result.

Before adding a dependency, ask:

1. What specific problem does this solve?
2. Can the existing stack solve it cleanly?
3. What performance cost does it introduce?
4. What bundle cost does it introduce?
5. Does it complicate maintenance?
6. Does it improve the actual experience?

Avoid dependency accumulation.

---

# Architecture

Maintain clear separation between:

- scene rendering
- animation state
- scroll state
- interaction state
- DOM content
- WebGL content
- transition orchestration
- form state
- loading state
- responsive behavior
- accessibility behavior

Do not place the entire experience inside one enormous component.

Prefer focused components and systems.

Possible conceptual structure:

- Experience
- Bottle
- Water
- Lighting
- Environment
- CameraRig
- ScrollController
- TransitionController
- TypographyLayer
- InquiryExperience
- InquiryForm
- LoadingExperience

These names are illustrative, not mandatory.

Choose architecture based on the actual implementation.

---

# Animation State

Complex interactions must have explicit state.

Possible states may include:

- loading
- ready
- revealing
- exploring
- transitionRequested
- bottleTilting
- pouring
- splashImpact
- splashCovering
- environmentChanging
- inquiryRevealing
- inquiry
- returning

Do not create fragile animation logic based on unrelated booleans and arbitrary setTimeout calls.

The signature transition should have a clear lifecycle.

Prevent duplicate interaction while the transition is running.

Repeated CTA activation must not create overlapping timelines.

---

# Loading

Do not reveal a broken or incomplete WebGL scene while assets load.

Account for:

- 3D models
- textures
- environment maps
- fonts
- shaders
- initial React hydration
- other critical assets

Loading treatment should fit the brand.

Do not build an elaborate loading animation unless it contributes meaningfully to the experience.

When the hero becomes visible, it should be visually ready.

Avoid obvious texture/model popping.

---

# Performance

Visual ambition does not justify poor performance.

Pay attention to:

- polygon count
- texture resolution
- texture compression
- environment maps
- shader complexity
- transparent material cost
- overdraw
- particle count
- post-processing
- device pixel ratio
- render loop behavior
- React renders
- asset loading
- bundle size
- memory usage
- WebGL resource disposal

Cap device pixel ratio where appropriate.

Do not blindly render at the device's maximum DPR.

Pause or reduce rendering work when possible.

Dispose of Three.js resources correctly.

Avoid unnecessary allocations inside animation/render loops.

Do not create new objects every frame when reusable objects are appropriate.

---

# Desktop and Mobile

Desktop receives the fullest interpretation of the experience.

Mobile must still feel intentionally designed.

Do not simply scale the desktop scene down.

Evaluate:

- camera framing
- bottle scale
- typography scale
- interaction density
- shader complexity
- particle count
- DPR
- scroll distance
- touch behavior
- GPU limitations

Simplify rendering before removing the conceptual experience.

Mobile should still communicate:

Bottle reveal
↓
Exploration
↓
CTA
↓
Bottle pours
↓
Water transition
↓
Inquiry

Lower-powered devices may receive simplified water rendering if necessary.

The idea must survive even if the implementation becomes less expensive.

---

# Reduced Motion

Respect:

prefers-reduced-motion

Reduced motion does not mean "broken version of the website."

Provide an intentional alternate interpretation.

Potential changes:

- shorter transitions
- reduced camera travel
- reduced parallax
- simplified bottle movement
- less scroll-linked movement
- simplified splash
- crossfade assisted by water texture instead of aggressive camera coverage

The conceptual relationship between bottle, water, and inquiry should remain.

---

# Accessibility

Experimental design does not excuse inaccessible interaction.

Ensure:

- semantic interactive elements
- keyboard accessibility
- visible focus states
- readable contrast
- useful form labels
- understandable validation
- sensible tab order
- reduced-motion support

Do not make essential content available only through hover.

The user must be able to reach the inquiry form without requiring precise pointer interaction.

---

# Failure and Fallback Behavior

WebGL may fail.

Assets may fail.

Devices may be underpowered.

The experience should degrade gracefully.

Consider fallback behavior for:

- WebGL unavailable
- model load failure
- texture load failure
- shader compilation failure
- reduced-motion users
- mobile/low-power devices

Do not allow a failed 3D scene to make the entire website unusable.

The CTA and inquiry path must remain reachable.

---

# Responsive QA

Test at minimum:

- large desktop
- normal laptop
- tablet-like width
- modern mobile width
- narrow mobile width

Check:

- clipping
- typography
- bottle framing
- camera framing
- form usability
- CTA placement
- scroll behavior
- orientation changes
- viewport resizing

Do not assume a Three.js composition remains correct after resizing.

---

# Motion QA

The signature transition must be tested repeatedly.

Specifically test:

- first activation
- rapid repeated clicks
- keyboard activation
- activation during unusual scroll positions
- resizing before activation
- resizing after activation
- mobile activation
- reduced-motion activation
- slow device behavior
- asset loading delays

Look for:

- animation jumps
- overlapping timelines
- bottle teleportation
- water appearing before the pour
- splash appearing disconnected from impact
- visible environment swapping
- form flashing early
- stale animation state
- locked scrolling
- inability to reach form
- WebGL artifacts

---

# Quality Standard

This is a portfolio project.

The quality bar is higher than a normal MVP.

Do not consider something finished merely because it technically works.

Evaluate:

- Does it feel intentional?
- Does it feel expensive?
- Does the motion have weight?
- Does the bottle feel physical?
- Does the water feel connected to the bottle?
- Does the transition have understandable cause and effect?
- Does typography belong to the environment?
- Does the composition evolve?
- Is there anything visually generic?
- Is there anything that looks like a framework default?
- Does the experience remain usable?
- Does it perform acceptably?
- Would this stand out among high-end interactive portfolio work?

If an interaction technically functions but visually feels cheap, it is not finished.

---

# Scope Discipline

Push the visual and interactive execution hard.

Do not expand the product scope unnecessarily.

This project does NOT need:

- authentication
- accounts
- dashboards
- CMS
- e-commerce
- checkout
- subscriptions
- database architecture
- user profiles
- admin panels
- analytics dashboards
- complex backend infrastructure

This is a focused luxury product landing experience.

Spend complexity on the experience, not unnecessary product infrastructure.

---

# Creative Freedom

Claude has substantial creative freedom within this project.

You may:

- improve compositions
- propose stronger interactions
- modify animation approaches
- adjust timing
- develop the fictional brand
- refine typography
- change lighting
- improve camera choreography
- develop new water interactions
- simplify expensive techniques
- replace weak ideas with stronger ones

Do not interpret requirements so literally that they prevent a better result.

However, preserve the core concept.

Non-negotiable:

- fictional luxury bottled water brand
- bottle is the central object
- bottle participates in the interface
- bottle initially rotates to reveal its branding
- experience is highly art-directed
- water/glass/light drive the visual language
- CTA causes the bottle itself to react
- bottle pours water
- pour leads to visible impact
- impact creates splash
- splash approaches/covers viewer
- water hides the environment transition
- inquiry experience appears on the other side
- transition feels continuous
- motion is smooth and deliberately paced
- mobile remains intentional
- reduced-motion is supported
- performance matters

---

# Do Not Fake the Signature Interaction

Do not substitute the core bottle/water interaction with:

- prerecorded video pretending to be interactive
- a simple blue overlay
- CSS blobs covering the viewport
- a generic wipe transition
- a fade-to-white disguised by a few particles
- stock splash footage
- an unrelated full-screen shader
- an instant scene swap

Illusion is acceptable.

Cheap illusion is not.

The implementation does not need scientifically accurate fluid physics, but the viewer must believe the water originated from the bottle and caused the transition.

---

# Development Workflow

Before major implementation:

1. Read this entire CLAUDE.md.
2. Inspect the existing repository.
3. Understand the existing stack.
4. Inspect package.json.
5. Inspect current components and styling.
6. Identify existing assets.
7. Determine what should be preserved.
8. Plan the 3D architecture.
9. Plan animation/state architecture.
10. Plan the bottle asset strategy.
11. Plan the water strategy.
12. Plan the splash transition before implementing it.
13. Consider performance before choosing rendering techniques.

Do not immediately begin installing packages and writing components.

Understand the project first.

---

# Implementation Strategy

Build difficult systems incrementally.

Recommended progression:

1. Establish page composition.
2. Establish WebGL canvas and camera.
3. Implement bottle.
4. Establish bottle materials and lighting.
5. Implement initial bottle reveal.
6. Establish scroll choreography.
7. Coordinate DOM typography.
8. Implement bottle transition state.
9. Implement bottle tilt.
10. Implement water pour.
11. Implement impact.
12. Implement splash.
13. Make splash achieve reliable viewport coverage.
14. Hide environment swap behind coverage.
15. Reveal inquiry environment.
16. Polish complete timeline.
17. Optimize.
18. Implement mobile adaptations.
19. Implement reduced-motion behavior.
20. Perform final QA.

Do not attempt to build every effect simultaneously.

Get each stage visually convincing before layering additional complexity.

---

# Testing and Verification

Before declaring work complete, run all applicable project checks.

At minimum:

- lint
- typecheck
- tests if present
- production build

Also manually verify:

- initial load
- bottle reveal
- scroll behavior
- complete CTA sequence
- inquiry form
- desktop
- mobile
- reduced motion
- resizing
- repeated interaction
- loading behavior
- failure behavior
- console output

Do not ignore warnings simply because the build succeeds.

Investigate relevant warnings.

---

# Browser Testing

Visual animation work must be evaluated visually.

Do not assume an animation is good because the code is mathematically correct.

Actually inspect:

- pacing
- easing
- continuity
- framing
- overlap
- timing
- readability
- perceived weight

Particularly inspect the signature transition at normal playback speed.

Do not judge it only by scrubbing animation timelines or reading duration values.

---

# Code Quality

Prefer:

- TypeScript
- clear component boundaries
- descriptive names
- reusable animation utilities where useful
- centralized configuration for meaningful motion values
- explicit state
- comments explaining unusual rendering techniques
- small focused functions

Avoid:

- giant components
- unexplained magic numbers everywhere
- duplicated animation logic
- deeply nested conditional rendering
- excessive global state
- arbitrary setTimeout chains
- unnecessary abstractions
- premature framework building

Animation constants may begin as experimental values, but consolidate important final values once the motion has been tuned.

---

# Comments

Comment why something exists, not what obvious code does.

Useful comment:

"Scene swap occurs after splash coverage passes this threshold so the old environment cannot flash through transparent regions."

Bad comment:

"Set opacity to 0."

Complex shader logic, rendering workarounds, browser-specific behavior, and non-obvious animation coordination should be documented.

---

# Git

The user controls repository history.

Do not:

- commit
- push
- create branches
- rewrite history
- force push

unless explicitly instructed.

At the end of meaningful work, suggest an appropriate commit message.

Example:

feat: build cinematic luxury water experience

Do not execute the commit unless explicitly requested.

---

# Completion Report

After substantial work, report:

1. What was built.
2. Major visual decisions.
3. Architecture decisions.
4. Bottle implementation.
5. Water implementation.
6. Splash transition implementation.
7. Animation/state architecture.
8. Responsive strategy.
9. Reduced-motion behavior.
10. Performance optimizations.
11. Dependencies added or removed.
12. Tests and checks performed.
13. Production build status.
14. Known limitations.
15. Areas worth visually inspecting.
16. Recommended next polish pass.
17. Suggested git commit message.

Be specific.

Do not simply say:

"Implemented the requested changes."

---

# Final Principle

When choosing between two implementations, prefer the one that makes the experience feel more intentional, physical, and memorable without compromising usability or performance.

This project should not demonstrate that Warped Web Studio can build a website.

It should demonstrate that Warped Web Studio can turn an idea into an experience.
