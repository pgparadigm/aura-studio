/* Craft knowledge — rhythm, groove and the reggaetón system. Book I, Parts 1-4, 6-7, 13-14, 17.
 *
 * These are principles, not trivia. Every entry names an Aura control that actually exists, or says
 * plainly that Aura cannot do the thing. Nothing here expires, so nothing here carries a date.
 */
(function (global) {
  'use strict';
  var K = global.AuraKnowledge;
  if (!K) return;

  K.add('rhythm', [
    {
      id: 'kick-on-the-floor',
      topic: 'The kick sits on every beat',
      triggers: [/kick/, /four on the floor/, /reggaeton|reggaetón|dembow/],
      beginner:
        'In this style the kick lands on every single beat — one, two, three, four. Not on 1 and 3, ' +
        'not syncopated. It is the one thing that cannot move: the moment the kick leaves the floor ' +
        'it stops being this style and becomes something else.',
      auraCan: [
        'Dembow builds a kick on all four beats and keeps it there.',
        'The Beat grid shows every kick, and you can move or remove any of them.',
      ],
      auraCannot: [],
      why: 'The kick is the anchor. The snare is what grooves against it.',
      source: 'Book I, Part 1 and Part 3',
    },
    {
      id: 'tresillo',
      topic: 'The 3-3-2 accent, called the tresillo',
      triggers: [/tresillo/, /3-3-2|3 3 2|three three two/, /accent|syncopat/],
      beginner:
        'A bar of sixteen steps split 3 + 3 + 2 instead of 4 + 4 + 4 + 4. Count it as one-two-three, ' +
        'one-two-three, one-two — the emphasis falls on steps 1, 4 and 7. That uneven grouping is ' +
        'what makes the pattern lean and move instead of marching.',
      auraCan: [
        'The Dembow control moves the snare and percussion onto the 3-3-2 accents.',
        'Swing shifts the off-steps so the lean is felt rather than counted.',
      ],
      auraCannot: [],
      why: 'It is the bridge between a steady kick and a groove that dances.',
      source: 'Book I, Part 4',
    },
    {
      id: 'bass-breath',
      topic: 'The low end has to breathe before the backbeat',
      triggers: [/bass.*breath|breath.*bass/, /bass.*(long|sustain|hold)/, /groove.*(stiff|flat)/,
                 /low end.*(long|sustain)/],
      beginner:
        'Take a four-step group and play the low end on three of them, leaving the fourth open just ' +
        'before the snare. That gap is the air the groove breathes through. Hold the bass all the way ' +
        'into the snare and the track stiffens — you can hear it go rigid.',
      auraCan: [
        'Bass Breath sets how much of that fourth step is left open.',
        'The low-end editor shows every note length, and you can shorten any of them.',
      ],
      auraCannot: [],
      why: 'Movement between the bass and the snare is what you feel as bounce.',
      source: 'Book I, Part 3 and Part 6',
    },
    {
      id: 'find-note-high-then-drop',
      topic: 'Find the bass note high, then drop it',
      triggers: [/bass note|wrong note|which note/, /octave.*bass|bass.*octave/],
      beginner:
        'Low notes all sound nearly right, because there is so much fundamental energy down there ' +
        'that your ear stops discriminating. Work the line out two octaves up where you can hear the ' +
        'pitch clearly, then move it down.',
      auraCan: [
        'Aura writes the low end from the harmony it detected, so the note follows the chord.',
        'You can move any low-end note in the Melody grid and hear it at pitch.',
      ],
      auraCannot: [],
      why: 'Writing a bassline directly in the low octaves is how a wrong note gets locked in.',
      source: 'Book I, Part 6',
    },
    {
      id: 'hat-variation',
      topic: 'Hats and shakers need variation, not repetition',
      // \b on short words that hide inside longer ones: bare /hat/ matches the "hat" in "what",
      // so "what tool should I use" was scoring a hi-hat entry above the tool router.
      triggers: [/\bhi.?hats?\b|\bhats?\b|shaker|percussion/, /robotic|mechanical|stiff|too even/],
      beginner:
        'Closed hats drive the groove; open hats add movement. Vary how hard each one hits — lean ' +
        'into the ones that land with the kick or the snare — or the pattern reads as a machine. ' +
        'A shaker layered over the closed hats is the usual way this style fills the top end.',
      auraCan: [
        'Heat varies hat and shaker velocity so the pattern breathes.',
        'Every hit is editable in the Beat grid, including its accent.',
      ],
      auraCannot: [],
      why: 'Even velocity is the fastest way to make a good pattern sound programmed.',
      source: 'Book I, Part 7',
    },
    {
      id: 'minimalism-first',
      topic: 'If it needs stacking, the sound was wrong',
      triggers: [/stack|layer.*more|too many (parts|sounds|layers)/, /crowded|cluttered|busy/,
                 /simpl(e|ify)/],
      beginner:
        'Reaching for another layer usually means the first sound was not the right one. Find the ' +
        'sound that already carries the part, and you will not need three more behind it.',
      auraCan: [
        'Find a sound explores families before you commit to a part.',
        'Mix Check tells you when a section is carrying more parts than it needs.',
        'Emotion Map shows which sections are dense all the way through.',
      ],
      auraCannot: [],
      why: 'Stacking is a symptom. The cure is upstream, in the sound choice.',
      source: 'Book I, Part 1 and Part 13',
    },
    {
      id: 'tempo-ranges',
      topic: 'Where the tempo sits, and what it does to the feel',
      triggers: [/bpm|tempo|how fast|speed/, /8[0-9]|9[0-9]|100/],
      beginner:
        'Slow and heavy sits around 80-88 and feels more sensual. 92 is the flexible middle — easy to ' +
        'push either way once the song tells you where it wants to go. 95-100 reads upbeat and summery. ' +
        'When you genuinely do not know, 92 is the honest starting point, not a hedge.',
      auraCan: [
        'Create something offers slow, mid and upbeat, or a tapped tempo, or a typed one.',
        'Tempo is editable at any time and every reconstruction is written to fit it.',
      ],
      auraCannot: [],
      why: 'Tempo is a feel decision. Let the melody argue for the change.',
      source: 'Book I, Part 2',
    },
    {
      id: 'build-twice-vary-once',
      topic: 'Let a section land before you change it',
      triggers: [/section.*(short|long)|how long.*section/, /repeat|twice/, /boring|drag/],
      beginner:
        'Run a section twice before the next change. A listener needs time to settle into a groove ' +
        'before being moved out of it. Then change one important thing — not five.',
      auraCan: [
        'Song Architect repeats sections at a length that lets the groove land.',
        'Every section is editable, and you can shorten the whole arrangement in one move.',
      ],
      auraCannot: [],
      why: 'Changing five things at once reads as a different song, not a development.',
      source: 'Book I, Part 9 and Part 13',
    },
    {
      id: 'cut-dont-add',
      topic: 'Impact comes from removing, not adding',
      triggers: [/chorus.*(bigger|explode|hit|impact|harder)/, /\bdrops?\b/, /\bbuild\b|tension/],
      beginner:
        'A chorus does not hit hard because you added something at the chorus. It hits because you ' +
        'took things away in the bar before, so the entry feels like everything returning at once. ' +
        'Drop the low end for a bar before the hook and the hook does the rest.',
      auraCan: [
        'Transition Designer can put a breather or a low-end drop before any section.',
        'Emotion Map finds hooks that arrive with no build in front of them.',
      ],
      auraCannot: [],
      why: 'Silence is the loudest thing you can put before a chorus.',
      source: 'Book I, Part 9 and Part 13',
    },
    {
      id: 'same-sound-new-role',
      topic: 'Reuse one sound instead of finding another',
      triggers: [/variation|variety|different section|same sound/, /pitch (up|down)/, /reverse/],
      beginner:
        'Pitched down it is an intro. Pitched up it is a hook accent. Reversed it is a transition. ' +
        'Filtered it is an outro. Recontextualising what you already have is usually better than ' +
        'introducing something new, and it keeps the record sounding like one thing.',
      auraCan: [
        'The sampler pitches, reverses, filters and re-times the same source across the song.',
        'Every transformation is recorded, so you can see what a slice has been through.',
      ],
      auraCannot: [],
      why: 'A record made of four related sounds beats one made of twelve unrelated ones.',
      source: 'Book I, Part 5 and Part 13',
    },
  ]);
})(window);
