# Plover design system — review draft

This is a proposal for founder review, not an implemented app theme. Open `review.html` for the interactive board. Preview choices are temporary and do not approve or save decisions. `tokens.proposed.json` records the starting proposals.

## Agreed brand foundations

- Quiet company; calm coaching without guilt or urgency.
- Sage #5E7F6B, cream #F3EEE1, ink #2F4236 and sand #D9CFB4. No pure white or black.
- Amber #E3B55B appears only on the bird's beak.
- Lowercase plover: Nunito 700 for the wordmark; Lexend for all other text.
- Whole-bird thinking loader and ordinary check for completion; standalone eye is parked.
- Accepted starting points: outlined lockups and deep-ink #243329 dark backgrounds with ink cards. Both can be refined.

## Selected foundation values

Captured from the founder's selected options on 2026-10-04: 16 px body text, 24 px card padding, 8 / 14 / 20 px control/card/panel radii, and clay errors (#9A453C light / #E7B6AE dark). These four decisions are selected; remaining proposals below still need review.

## Selected component and character direction

The founder completed the remaining-choice review on 2026-10-04: balanced primary actions (compact ink/cream actions, sage for larger brand moments), one featured peek per view, quiet idle breathing with a static focus state and one small completion hop, and the round corner sitter replacing Puff. Thinking uses the whole bird; reduced motion removes character movement while retaining text status. All eight offered decisions are recorded in `choices.selected.json`. Detailed implementation values below remain proposed unless explicitly selected.

## Detailed specification

### Typography and density

Lexend display 40/500, page heading 28/500, section 20/500, body 16/400, labels 14/500 and captions 12/400. Body line height 1.6; readable text width at most 65 characters. Captions do not carry essential instructions. Use sentence case; uppercase only for short optional metadata. Timers use tabular numbers. Weight 700 is reserved for large sage-filled brand actions.

### Spacing, layout and shape

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Default card padding 24 px, grid gaps 24 px, page padding 32 px (16 px narrow). Controls 8 px radius, cards 14 px, large panels 20 px; pills only for short metadata. Controls and icon buttons at least 44 px high. Icons 20 px with 2 px rounded strokes. Desktop sidebar 208 px; collapse on narrow screens. Content reflows without hiding essential text. No ornamental gradients; borders provide depth, with shadow only when needed for floating panels.

### Semantic colours and actions

Light: cream page and cards, sand quiet surfaces, ink text. Sand is a decorative divider, not the sole boundary of an input. Inputs use sage boundaries. Secondary text stays ink, distinguished by hierarchy rather than low opacity.

Dark: deep-ink page, ink cards, cream primary text, sand secondary text. Sand boundaries for controls; translucent sand for decorative dividers.

Compact primary buttons: ink fill / cream text in light mode; cream fill / ink text in dark mode, with 14–16 px labels. The existing sage fill / cream text is retained for larger brand actions at 19 px and weight 700. Cream on sage measures 3.84:1, so small regular labels do not use that combination. Sage text on cream is reserved for large headings. No ink text on sage.

Success uses the normal sage check plus a text label. Information and warnings use a distinct icon and explicit wording in the regular text colour. Selected clay errors (#9A453C light / #E7B6AE dark) use an X icon, an inline explanation and a stronger boundary. This is a status-colour exception to the four core brand colours. Status never relies on colour alone. Amber cannot become a warning colour.

### Components and states

- Buttons: compact primary, secondary outline, text and large brand action. Default, hover, pressed, focus, disabled and loading states. Hover changes boundary/underline; pressed moves down 1 px; focus is a visible 2 px ring with 3 px offset. Disabled stays readable, uses native disabled semantics, and has no hover/press effect. Loading preserves width and shows explicit status text; bird loader only for actual Plover thinking.
- Inputs: persistent label, optional helper, visible control boundary, focus ring, inline error, read-only and disabled states. Placeholder supplements the label. Validate at the appropriate boundary and retain entered content.
- Task rows: 44 px or taller, check plus descriptive task text; current step has a labelled Now state. Completed text remains readable. Checkbox remains keyboard reachable; essential meaning is not conveyed by strike-through alone.
- Navigation: selected item is marked by fill and text weight, with aria-current. Icon-only actions need accessible names. Links stay visibly identifiable.
- Selects and switches: native semantics, explicit labels, clear checked/selected state. A switch controls an immediate setting; a checkbox selects a task or form option.
- Cards: title, content and optional action. Decorative card borders do not imply clickability. One primary action per local group.
- Dialogs: labelled title, plain explanation, explicit primary and cancel actions; focus enters the dialog, stays contained, Escape closes, and focus returns to the trigger. Destructive action names the object. No auto-dismiss for consequential choices.
- Feedback: inline validation by the field; non-blocking status in a polite live region. A dismissible notice has a named close action. Loading, empty, success and failure states all include text and a next action where relevant.

### Character, icons, voice and motion

Selected edge frequency: one featured peek per view; crop at a real edge, preserve the beak, reserve space and keep active work clear. On cream, a sand outline helps the bird remain visible. Do not use the eye alone. The round corner sitter replaces Puff as the selected desktop character; its full six-state rig remains implementation work.

Plain outline icons with rounded ends and no new icon library. Regular check for completion. Bird only for thinking, company and celebration; not for every status or control.

Copy: brief, concrete and kind. Examples: “One step at a time.”, “A first draft is enough.”, “Couldn’t save this task. Try again.” Avoid guilt, streak pressure and unrequested chatter.

UI transitions remain proposed at 120/200/300 ms, gentle ease, no decorative spring bounce. Selected character motion: gentle five-second idle breathing, whole-bird thinking motion and one small completion hop. Reduced motion removes bobbing, hopping and sliding; text status remains. No mascot movement while reading or typing in focus mode.

## Review sequence

1. Typography and density.
2. Spacing and corner sizes.
3. Compact versus large brand actions, and palette-only versus clay errors.
4. Component behaviour, focus and feedback.
5. Character frequency and motion; desktop buddy choice separately.

After confirmation, turn approved proposals into implementation tokens and a component checklist. Favicon, export kit and app implementation wait until this review is settled.
